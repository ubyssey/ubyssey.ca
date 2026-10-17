import json
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from wagtail.models import Page, Site

from .models import ElectionResultsSnapshot
from .services import MAYOR_NAMES, import_results, parse_results


def city_document():
    mayor = []
    for index, name in enumerate(MAYOR_NAMES):
        first, last = name.split(" ", 1)
        mayor.append({
            "choiceName": f"{index + 1} {last.upper()}, {first.title()}",
            "votes": (index + 1) * 100,
            "percentage": f"{index + 1}.5%",
            "isWinner": 1 if index == 1 else 2,
            "partyBreakdown": [{"partyName": "ABC Vancouver"}],
        })
    council = [{
        "choiceName": f"{index + 10} Person{index}, Test",
        "votes": 200 - index,
        "percentage": "2%",
        "isWinner": 2,
        "partyBreakdown": [{"partyName": "COPE"}],
    } for index in range(24)]
    return {
        "statistics": {"timeStamp": "2026-10-17 20:10:00", "globPolls": 149, "globClosedPolls": 12},
        "areaResults": [{"2": {"contestResults": [
            {"contestName": "MAYOR", "choiceResults": mayor},
            {"contestName": "COUNCILLOR", "choiceResults": council},
        ]}}],
    }


class ResultsParserTests(SimpleTestCase):
    def test_parses_only_tracked_mayor_and_top_20_council(self):
        document = city_document()
        document["areaResults"][0]["2"]["contestResults"][0]["choiceResults"].append({
            "choiceName": "99 OTHER, Candidate", "votes": 99999,
            "percentage": "99%", "isWinner": 2, "partyBreakdown": [],
        })
        data = parse_results(json.dumps(document).encode())
        self.assertEqual(len(data["mayor"]), 5)
        self.assertEqual(len(data["council"]), 20)
        self.assertEqual(data["mayor"][0]["name"], "Rebecca Bligh")
        self.assertEqual(data["council"][0]["votes"], 200)
        self.assertTrue(next(row for row in data["mayor"] if row["name"] == "Ken Sim")["winner"])
        self.assertEqual(data["source_time"], "2026-10-17T20:10:00-07:00")

    def test_rejects_missing_tracked_candidate(self):
        document = city_document()
        document["areaResults"][0]["2"]["contestResults"][0]["choiceResults"].pop()
        with self.assertRaises(ValidationError):
            parse_results(json.dumps(document).encode())

    def test_finds_vancouver_contests_if_area_order_changes(self):
        document = city_document()
        document["areaResults"].insert(0, {"4": {"contestResults": []}})
        self.assertEqual(len(parse_results(json.dumps(document).encode())["mayor"]), 5)

    def test_rejects_unrecognized_winner_code(self):
        document = city_document()
        document["areaResults"][0]["2"]["contestResults"][0]["choiceResults"][0]["isWinner"] = 0
        with self.assertRaises(ValidationError):
            parse_results(json.dumps(document).encode())

    def test_rejects_oversized_file(self):
        with self.assertRaises(ValidationError):
            parse_results(b"x" * (2 * 1024 * 1024 + 1))


class SnapshotTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(
            hostname="election-results.test", port=80,
            root_page=Page.get_first_root_node(),
        )

    def test_rejected_older_file_preserves_last_good_snapshot(self):
        first = city_document()
        snapshot = import_results(self.site, json.dumps(first).encode(), "upload")
        first_digest = snapshot.sha256

        older = city_document()
        older["statistics"]["timeStamp"] = "2026-10-16 20:10:00"
        older["areaResults"][0]["2"]["contestResults"][0]["choiceResults"][0]["votes"] = 9999
        with self.assertRaises(ValidationError):
            import_results(self.site, json.dumps(older).encode(), "upload")

        snapshot.refresh_from_db()
        self.assertEqual(snapshot.sha256, first_digest)
        self.assertEqual(ElectionResultsSnapshot.objects.filter(site=self.site).count(), 1)

    def test_newer_file_replaces_snapshot(self):
        first = city_document()
        snapshot = import_results(self.site, json.dumps(first).encode(), "upload")
        later = city_document()
        later["statistics"]["timeStamp"] = "2026-10-17 20:15:00"
        later["areaResults"][0]["2"]["contestResults"][0]["choiceResults"][0]["votes"] = 9999
        import_results(self.site, json.dumps(later).encode(), "sftp")
        snapshot.refresh_from_db()
        self.assertEqual(snapshot.data["mayor"][0]["votes"], 9999)
        self.assertEqual(snapshot.source, "sftp")
