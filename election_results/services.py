"""Fetch, validate and publish City of Vancouver results as one last-good snapshot."""

import base64
import hashlib
import json
import logging
import os
import re
import socket
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.utils import timezone

from .models import ElectionResultsSettings, ElectionResultsSnapshot

logger = logging.getLogger(__name__)

MAX_JSON_BYTES = 2 * 1024 * 1024
SFTP_HOST = "ftp2.vancouver.ca"
SFTP_PORT = 22022
SFTP_PATH = "/elections/arearesults.json"
MAYOR_NAMES = {
    "pete fry": "pete_fry",
    "ken sim": "ken_sim",
    "colleen hardwick": "colleen_hardwick",
    "kareem allam": "kareem_allam",
    "rebecca bligh": "rebecca_bligh",
}


def _required_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"Missing or invalid {label}.")
    return value.strip()


def _candidate_name(value):
    raw = re.sub(r"^\s*\d+\s+", "", _required_text(value, "candidate name"))
    if "," in raw:
        surname, given = raw.split(",", 1)
        raw = f"{given.strip()} {surname.strip().title()}"
    return " ".join(raw.split())


def _candidate(row):
    if not isinstance(row, dict):
        raise ValidationError("A candidate result is not an object.")
    name = _candidate_name(row.get("choiceName"))
    votes = row.get("votes")
    if type(votes) is not int or not 0 <= votes <= 100_000_000:
        raise ValidationError(f"Invalid vote total for {name}.")
    percentage = _required_text(row.get("percentage"), f"percentage for {name}")
    if not re.fullmatch(r"(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%", percentage):
        raise ValidationError(f"Invalid percentage for {name}.")
    winner_code = row.get("isWinner")
    if winner_code not in (1, 2) or type(winner_code) is not int:
        raise ValidationError(f"Unknown winner code for {name}.")
    parties = row.get("partyBreakdown") or []
    if not isinstance(parties, list):
        raise ValidationError(f"Invalid party for {name}.")
    party = ""
    if parties:
        if not isinstance(parties[0], dict):
            raise ValidationError(f"Invalid party for {name}.")
        party = str(parties[0].get("partyName") or "").strip()[:100]
    return {
        "name": name[:120], "votes": votes, "percentage": percentage,
        "winner": winner_code == 1, "party": party,
    }


def parse_results(raw):
    """Return a small, display-safe document or raise without touching saved data."""
    if isinstance(raw, str):
        raw = raw.encode("utf-8")
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_JSON_BYTES:
        raise ValidationError("The JSON file is empty or exceeds 2 MB.")
    try:
        document = json.loads(raw)
        stats = document["statistics"]
        contest_results = next(
            area["2"]["contestResults"] for area in document["areaResults"]
            if isinstance(area, dict) and isinstance(area.get("2"), dict)
            and "contestResults" in area["2"]
        )
        if not isinstance(stats, dict) or not isinstance(contest_results, list):
            raise TypeError
        timestamp = datetime.strptime(stats["timeStamp"], "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError, KeyError, IndexError, StopIteration, UnicodeDecodeError) as exc:
        raise ValidationError("This is not a supported City of Vancouver arearesults.json file.") from exc

    contests = {}
    for contest in contest_results:
        if not isinstance(contest, dict):
            continue
        name = contest.get("contestName")
        if name in ("MAYOR", "COUNCILLOR"):
            if name in contests or not isinstance(contest.get("choiceResults"), list):
                raise ValidationError(f"Duplicate or invalid {name} contest.")
            contests[name] = [_candidate(row) for row in contest["choiceResults"]]
    if set(contests) != {"MAYOR", "COUNCILLOR"}:
        raise ValidationError("The mayor or council contest is missing.")

    mayor_by_name = {row["name"].casefold(): row for row in contests["MAYOR"]}
    if not all(name in mayor_by_name for name in MAYOR_NAMES):
        raise ValidationError("At least one of the five tracked mayoral candidates is missing.")
    mayor = [dict(mayor_by_name[name], asset_key=key) for name, key in MAYOR_NAMES.items()]
    mayor.sort(key=lambda row: (-row["votes"], row["name"]))
    council = sorted(contests["COUNCILLOR"], key=lambda row: (-row["votes"], row["name"]))[:20]
    if len(council) < 20:
        raise ValidationError("Fewer than 20 council candidates were supplied.")

    polls_total = stats.get("globPolls")
    polls_closed = stats.get("globClosedPolls")
    if any(type(number) is not int or number < 0 for number in (polls_total, polls_closed)) or polls_closed > polls_total:
        raise ValidationError("Invalid poll counts.")
    return {
        "source_time": timezone.make_aware(timestamp, ZoneInfo("America/Vancouver")).isoformat(),
        "polls_total": polls_total,
        "polls_closed": polls_closed,
        "mayor": mayor,
        "council": council,
    }


def _credential(name):
    file_path = os.environ.get(f"{name}_FILE") or f"/run/secrets/{name}"
    if os.path.isfile(file_path):
        with open(file_path, encoding="utf-8") as secret_file:
            return secret_file.read().strip()
    return os.environ.get(name, "").strip()


def fetch_results():
    """Password SFTP with a mandatory independently verified SHA256 host-key pin."""
    import paramiko

    username = _credential("ELECTION_SFTP_USERNAME")
    password = _credential("ELECTION_SFTP_PASSWORD")
    expected = _credential("ELECTION_SFTP_HOST_KEY_SHA256")
    if not all((username, password, expected)) or not expected.startswith("SHA256:"):
        raise RuntimeError("Election SFTP credentials or verified host-key fingerprint are not configured.")

    sock = socket.create_connection((SFTP_HOST, SFTP_PORT), timeout=10)
    sock.settimeout(20)
    transport = paramiko.Transport(sock)
    try:
        transport.start_client(timeout=15)
        server_key = transport.get_remote_server_key()
        actual = "SHA256:" + base64.b64encode(hashlib.sha256(server_key.asbytes()).digest()).decode("ascii").rstrip("=")
        if actual != expected:
            raise RuntimeError("Election SFTP server host key does not match the verified fingerprint.")
        transport.auth_password(username, password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            with sftp.open(SFTP_PATH, "rb") as source:
                raw = source.read(MAX_JSON_BYTES + 1)
        finally:
            sftp.close()
    finally:
        transport.close()
    if len(raw) > MAX_JSON_BYTES:
        raise ValidationError("The election JSON exceeds 2 MB.")
    return raw


def import_results(site, raw, source):
    if source not in ("sftp", "upload"):
        raise ValueError("Invalid import source")
    normalized = parse_results(raw)
    digest = hashlib.sha256(raw).hexdigest()
    source_time = datetime.fromisoformat(normalized["source_time"])
    with transaction.atomic():
        snapshot, _ = ElectionResultsSnapshot.objects.select_for_update().get_or_create(
            site=site, defaults={"data": normalized, "source_timestamp": source_time, "source": source, "sha256": digest}
        )
        if snapshot.sha256 != digest:
            if source_time < snapshot.source_timestamp:
                raise ValidationError("This file is older than the current results snapshot.")
            snapshot.data = normalized
            snapshot.source_timestamp = source_time
            snapshot.source = source
            snapshot.sha256 = digest
            snapshot.save()
        else:
            snapshot.save(update_fields=["imported_at"])
    return snapshot


def _single_import(site, source, raw=None, scheduled=False):
    """MySQL advisory lock deduplicates four web-container crons and manual imports."""
    if connection.vendor != "mysql":
        return import_results(site, raw if raw is not None else fetch_results(), source)
    lock_name = f"election_results_{site.id}"
    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(%s, 0)", [lock_name])
        acquired = cursor.fetchone()[0] == 1
    if not acquired:
        return None
    try:
        if scheduled and ElectionResultsSnapshot.objects.filter(
            site=site, imported_at__gt=timezone.now() - timedelta(minutes=4)
        ).exists():
            return None
        return import_results(site, raw if raw is not None else fetch_results(), source)
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", [lock_name])


def manual_import(site, raw=None):
    return _single_import(site, "upload" if raw is not None else "sftp", raw)


def scheduled_refresh():
    for config in ElectionResultsSettings.objects.select_related("site", "liveblog_page").filter(automatic_updates_enabled=True):
        page = config.liveblog_page
        if not page or not page.live or not page.is_live():
            continue
        try:
            _single_import(config.site, "sftp", scheduled=True)
        except Exception:
            logger.exception("Election results refresh failed for site %s; keeping last-good snapshot", config.site_id)
