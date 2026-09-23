from datetime import timedelta
from itertools import combinations

from django import forms
from django.template.loader import get_template
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from home.blocks import GameAnalysisPanel, SPORT_CHOICES
from home.game_analysis_queries import FIXTURE_LIMIT, fixture_queues
from home.models import HomePage, ThunderbirdFixture


class HomepageRedesignTests(SimpleTestCase):
    def test_redesign_templates_compile(self):
        templates = [
            "home/home_page.html",
            "home/components/redesign_nav.html",
            "home/components/redesign_card.html",
            "home/components/ams_election.html",
            "home/components/game_analysis_story.html",
            "home/components/redesign_story_row.html",
            "home/stream_blocks/game_analysis.html",
        ]
        for template_name in templates:
            with self.subTest(template=template_name):
                self.assertIsNotNone(get_template(template_name))

    def test_game_analysis_panel_exposes_editorial_fields(self):
        self.assertEqual(
            set(GameAnalysisPanel().child_blocks),
            {"active_sports", "articles"},
        )
        self.assertIsInstance(
            GameAnalysisPanel().child_blocks["active_sports"].field.widget,
            forms.CheckboxSelectMultiple,
        )

    def test_game_analysis_panel_excludes_womens_rugby_from_current_controls(self):
        self.assertNotIn("rugby-w", dict(SPORT_CHOICES))
        active_sport_choices = GameAnalysisPanel().child_blocks["active_sports"].field.choices
        self.assertNotIn("rugby-w", dict(active_sport_choices))

    def test_homepage_has_named_hero_positions(self):
        fields = {field.name for field in HomePage._meta.get_fields()}
        self.assertTrue({
            "redesign_hero_top_left",
            "redesign_hero_bottom_left",
            "redesign_hero_centre",
            "redesign_hero_top_right",
            "redesign_hero_bottom_right",
        }.issubset(fields))

    def test_ams_election_is_opt_in_with_default_middle_placement(self):
        homepage = HomePage()
        self.assertFalse(homepage.ams_election_enabled)
        self.assertEqual(homepage.ams_election_placement, "between_hero_games")
        self.assertEqual(homepage.ams_election_heading, "2026 AMS VP Student Life By-Election")
        self.assertEqual(len(HomePage.AMS_ELECTION_PLACEMENTS), 3)


class GameAnalysisFixtureQueryTests(TestCase):
    def test_five_per_sport_preserves_first_five_for_every_filter_combination(self):
        now = timezone.now()
        sports = ["soccer-m", "hockey-w", "basketball-m"]
        for sport_index, sport in enumerate(sports):
            for game_index in range(7):
                for direction in (-1, 1):
                    ThunderbirdFixture.objects.create(
                        source_event=f"{sport}-{game_index}-{direction}",
                        sport=sport,
                        starts_at=now + direction * timedelta(
                            hours=game_index * 3 + sport_index + 1
                        ),
                        away_name="Away",
                        home_name="Home",
                    )

        upcoming, recent = fixture_queues(sports, now)
        self.assertEqual(len(upcoming), len(sports) * FIXTURE_LIMIT)
        self.assertEqual(len(recent), len(sports) * FIXTURE_LIMIT)

        for count in range(1, len(sports) + 1):
            for selection in combinations(sports, count):
                expected_upcoming = list(
                    ThunderbirdFixture.objects.filter(sport__in=selection, starts_at__gte=now)
                    .order_by("starts_at", "pk")
                    .values_list("pk", flat=True)[:FIXTURE_LIMIT]
                )
                expected_recent = list(
                    ThunderbirdFixture.objects.filter(sport__in=selection, starts_at__lt=now)
                    .order_by("-starts_at", "-pk")
                    .values_list("pk", flat=True)[:FIXTURE_LIMIT]
                )
                self.assertEqual(
                    [game.pk for game in upcoming if game.sport in selection][:FIXTURE_LIMIT],
                    expected_upcoming,
                )
                self.assertEqual(
                    [game.pk for game in recent if game.sport in selection][:FIXTURE_LIMIT],
                    expected_recent,
                )
