"""Import helpers shared by the CMS calendar uploader and management command."""

import csv
from datetime import datetime, timedelta
from io import TextIOWrapper

from django.utils import timezone

from home.models import ThunderbirdFixture


SPORT_MAP = {
    "Women's Basketball": "basketball-w", "Men's Basketball": "basketball-m",
    "Football": "football", "Women's Hockey": "hockey-w", "Men's Hockey": "hockey-m",
    "Women's Soccer": "soccer-w", "Men's Soccer": "soccer-m",
    "Women's Rugby": "rugby-w",
    "Women's Volleyball": "volleyball-w", "Men's Volleyball": "volleyball-m",
}

LOGOS = {
    "UBC Thunderbirds": "ubyssey/images/homepage/team_logos/ubc_thunderbirds.png",
    "University of the Fraser Valley": "ubyssey/images/homepage/team_logos/ufv_cascades.png",
    "Trinity Western University": "ubyssey/images/homepage/team_logos/trinity_western_spartans.png",
    "UBC-Okanagan": "ubyssey/images/homepage/team_logos/ubco_heat.png",
    "University of Calgary": "ubyssey/images/homepage/team_logos/ucalgary_dinos.png",
    "University of Alberta": "ubyssey/images/homepage/team_logos/uofa_bears.png",
    "University of Alberta Pandas": "ubyssey/images/homepage/team_logos/ualberta_pandas.png",
    "University of Victoria": "ubyssey/images/homepage/team_logos/uvic_vikes.png",
    "University of Manitoba": "ubyssey/images/homepage/team_logos/umanitoba_bisons.png",
    "University of Regina": "ubyssey/images/homepage/team_logos/uregina_rams.png",
    "University of Regina Rams": "ubyssey/images/homepage/team_logos/uregina_rams.png",
    "University of Saskatchewan": "ubyssey/images/homepage/team_logos/usaskatchewan_logo.png",
    "University of Northern British Columbia": "ubyssey/images/homepage/team_logos/unbc_timberwolves.png",
    "University of Lethbridge": "ubyssey/images/homepage/team_logos/ulethbridge_horns.png",
    "Thompson Rivers University": "ubyssey/images/homepage/team_logos/tru_wolfpack.png",
    "MacEwan University": "ubyssey/images/homepage/team_logos/macewan_griffins.png",
    "Mount Royal University": "ubyssey/images/homepage/team_logos/mountroyal_cougars.svg",
}


def opponent_and_sides(event):
    if " vs " in event:
        return event.split(" vs ", 1)[1], False
    if " at " in event:
        return event.split(" at ", 1)[1], True
    raise ValueError("Fixture has no opponent separator")


def import_calendar(calendar):
    """Import supported fixtures from a Thunderbird calendar file object.

    Existing score fields are deliberately untouched, so schedule refreshes do
    not erase results entered by the sports desk.
    """
    if not hasattr(calendar, "read"):
        calendar = calendar.open("r", newline="", encoding="utf-8-sig")
    elif "b" in getattr(calendar, "mode", "b"):
        calendar = TextIOWrapper(calendar, encoding="utf-8-sig", newline="")

    imported = skipped = reconciled = 0
    for row in csv.DictReader(calendar):
        sport = SPORT_MAP.get(row.get("Category", ""))
        if not sport:
            continue
        try:
            event = row["Event"]
            opponent, ubc_is_away = opponent_and_sides(event)
            starts_at = datetime.strptime(
                f"{row['Start Date']} {row.get('Start Time') or '12:00AM'}", "%m/%d/%Y %I:%M%p"
            )
        except (KeyError, TypeError, ValueError):
            skipped += 1
            continue

        starts_at = timezone.make_aware(starts_at, timezone.get_current_timezone())
        away, home = ("UBC Thunderbirds", opponent) if ubc_is_away else (opponent, "UBC Thunderbirds")
        opponent_logo = LOGOS.get(opponent, "")
        if opponent == "University of Alberta" and row["Category"].startswith("Women's"):
            opponent_logo = LOGOS["University of Alberta Pandas"]
        source_event = event + "|" + row["Start Date"] + "|" + (row.get("Start Time") or "")
        fixture = ThunderbirdFixture.objects.filter(source_event=source_event).first()
        if fixture is None:
            # Schedule publishers sometimes correct a start time or date. If
            # exactly one otherwise-identical fixture is nearby, retain its
            # editor-entered score rather than creating a duplicate result.
            candidates = ThunderbirdFixture.objects.filter(
                sport=sport,
                away_name=away,
                home_name=home,
                starts_at__range=(starts_at - timedelta(days=14), starts_at + timedelta(days=14)),
            )
            if candidates.count() == 1:
                fixture = candidates.first()
                fixture.source_event = source_event
                reconciled += 1
            else:
                fixture = ThunderbirdFixture(
                    source_event=source_event, sport=sport, starts_at=starts_at, away_name=away, home_name=home
                )
        fixture.sport = sport
        fixture.starts_at = starts_at
        fixture.venue = row.get("Facility") or row.get("Location") or ""
        fixture.away_name, fixture.home_name = away, home
        fixture.away_logo = LOGOS["UBC Thunderbirds"] if ubc_is_away else opponent_logo
        fixture.home_logo = opponent_logo if ubc_is_away else LOGOS["UBC Thunderbirds"]
        fixture.save()
        imported += 1
    return {"imported": imported, "skipped": skipped, "reconciled": reconciled}
