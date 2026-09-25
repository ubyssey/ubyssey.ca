from datetime import datetime, timedelta, timezone as datetime_timezone
from itertools import combinations
from types import SimpleNamespace
from unittest.mock import patch

from django import forms
from django.template.loader import get_template
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.utils import timezone

from home.blocks import GameAnalysisPanel, SPORT_CHOICES
from home.game_analysis_queries import (
    FIXTURE_LIMIT,
    chronological_articles,
    fixture_queues,
    panel_active_sports,
    six_month_cutoff,
)
from home.models import HomePage, ThunderbirdFixture
from home.views import game_analysis_filter


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

    def test_active_sports_follow_cms_configuration(self):
        self.assertEqual(panel_active_sports({"active_sports": ["hockey-w", "soccer-m"]}), ["hockey-w", "soccer-m"])
        self.assertNotIn("rugby-w", panel_active_sports())

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

    def test_game_analyses_remains_enabled_by_default(self):
        self.assertTrue(HomePage().game_analysis_enabled)

    def test_disabled_panel_skips_homepage_game_queries(self):
        homepage = HomePage(game_analysis_enabled=False)
        with patch("wagtail.models.Page.get_context", return_value={}), \
                patch.object(homepage, "get_curated_articles", return_value=[]), \
                patch("home.models.ArticlePage"), \
                patch("home.models.settings.DEBUG", False), \
                patch("home.game_analysis_queries.fixture_queues") as fixtures, \
                patch("home.game_analysis_queries.chronological_articles") as stories:
            homepage.get_context(RequestFactory().get("/"))
        fixtures.assert_not_called()
        stories.assert_not_called()

    def test_six_month_cutoff_uses_calendar_months(self):
        now = datetime(2026, 8, 31, 15, 30, tzinfo=datetime_timezone.utc)
        self.assertEqual(
            six_month_cutoff(now),
            datetime(2026, 2, 28, 15, 30, tzinfo=datetime_timezone.utc),
        )

    def test_filtered_stories_are_recent_sports_game_analyses(self):
        cutoff = datetime(2026, 3, 25, tzinfo=datetime_timezone.utc)
        with patch("home.game_analysis_queries.ArticlePage") as article_model, \
                patch("home.game_analysis_queries.six_month_cutoff", return_value=cutoff):
            queryset = article_model.objects.live.return_value.public.return_value
            queryset.filter.return_value.order_by.return_value.specific.return_value.__getitem__.return_value = []
            self.assertEqual(chronological_articles(["soccer-w"]), [])
        queryset.filter.assert_called_once_with(
            current_section="sports",
            standardarticlepage__story_form="game-analysis",
            covered_sport__in=["soccer-w"],
            explicit_published_at__gte=cutoff,
        )


class GameAnalysisFixtureQueryTests(TestCase):
    def test_each_selection_returns_only_its_first_five_chronological_fixtures(self):
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
        self.assertEqual(len(upcoming), FIXTURE_LIMIT)
        self.assertEqual(len(recent), FIXTURE_LIMIT)

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
                selected_upcoming, selected_recent = fixture_queues(selection, now)
                self.assertEqual(
                    [game.pk for game in selected_upcoming],
                    expected_upcoming,
                )
                self.assertEqual(
                    [game.pk for game in selected_recent],
                    expected_recent,
                )


class GameAnalysisFilterViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.site = SimpleNamespace(root_page_id=42)
        self.home = SimpleNamespace(pk=42, game_analysis=[], game_analysis_enabled=True)

    def test_disabled_panel_rejects_filters_without_querying_content(self):
        self.home.game_analysis_enabled = False
        request = self.factory.get("/game-analysis/filter/?sport=soccer-w")
        with patch("home.views.Site.find_for_request", return_value=self.site), \
                patch("home.views.HomePage") as homepage_model, \
                patch("home.views.chronological_articles") as stories, \
                patch("home.views.fixture_queues") as fixtures:
            homepage_model.objects.live.return_value.public.return_value.filter.return_value.first.return_value = self.home
            response = game_analysis_filter(request)
        self.assertEqual(response.status_code, 404)
        stories.assert_not_called()
        fixtures.assert_not_called()

    def test_rejects_inactive_sport_before_querying_content(self):
        request = self.factory.get("/game-analysis/filter/?sport=rugby-w")
        with patch("home.views.Site.find_for_request", return_value=self.site), \
                patch("home.views.HomePage") as homepage_model, \
                patch("home.views.chronological_articles") as stories:
            homepage_model.objects.live.return_value.public.return_value.filter.return_value.first.return_value = self.home
            response = game_analysis_filter(request)
        self.assertEqual(response.status_code, 400)
        stories.assert_not_called()

    def test_fetches_only_selected_sports_and_returns_empty_states(self):
        request = self.factory.get("/game-analysis/filter/?sport=soccer-m&sport=hockey-w")
        with patch("home.views.Site.find_for_request", return_value=self.site), \
                patch("home.views.HomePage") as homepage_model, \
                patch("home.views.cache") as response_cache, \
                patch("home.views.chronological_articles", return_value=[]) as stories, \
                patch("home.views.fixture_queues", return_value=([], [])) as fixtures:
            homepage_model.objects.live.return_value.public.return_value.filter.return_value.first.return_value = self.home
            response_cache.get.return_value = None
            response = game_analysis_filter(request)
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"stories": "", "upcoming": "", "recent": ""})
        stories.assert_called_once_with(["hockey-w", "soccer-m"])
        self.assertEqual(fixtures.call_args.args[0], ["hockey-w", "soccer-m"])
