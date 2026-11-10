from datetime import datetime, timedelta, timezone as datetime_timezone
from itertools import combinations
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django import forms
from django.template import Context, Template
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
from home.models import (
    BCLocalElectionsPage, BCProvincialElectionsPage, HomePage, ThunderbirdFixture,
    WomensSoccerChampionshipPage, WomensSoccerMatch, WomensSoccerMatchesPage, WomensSoccerTeamsPage,
)
from home.sports_calendar import import_calendar
from home.views import game_analysis_filter


class HomepageRedesignTests(SimpleTestCase):
    def test_redesign_templates_compile(self):
        templates = [
            "home/home_page.html",
            "home/components/redesign_nav.html",
            "home/components/redesign_card.html",
            "home/components/ams_election.html",
            "home/components/bc_elections_banner.html",
            "home/components/bc_elections_panel.html",
            "home/components/bc_election_story_card.html",
            "home/components/bc_election_party.html",
            "home/components/bc_election_live_story.html",
            "home/bc_local_elections_page.html",
            "home/bc_provincial_elections_page.html",
            "home/components/bc_provincial_banner.html",
            "home/components/bc_provincial_panel.html",
            "home/components/bc_provincial_featured_story.html",
            "home/womens_soccer_championship_page.html",
            "home/womens_soccer_data_preview.html",
            "home/components/soccer_champ_banner.html",
            "home/components/soccer_champ_panel.html",
            "home/components/soccer_champ_featured.html",
            "home/components/soccer_champ_results.html",
            "home/components/soccer_champ_match.html",
            "home/components/soccer_champ_team_row.html",
            "home/components/soccer_champ_analysis.html",
            "home/components/game_analysis_story.html",
            "home/components/redesign_story_row.html",
            "home/stream_blocks/game_analysis.html",
        ]
        for template_name in templates:
            with self.subTest(template=template_name):
                self.assertIsNotNone(get_template(template_name))

    def test_homepage_title_entities_decode_without_trusting_markup(self):
        headline = Template("{% load articletags %}{{ title|safe_headline_markup }}")
        cases = {
            "&lt;em&gt;Arts &amp; Culture&lt;/em&gt;": "<em>Arts &amp; Culture</em>",
            "<em>Not For Sale!</em>": "<em>Not For Sale!</em>",
            '<em onclick="alert(1)">Title</em>': "<em>Title</em>",
            "<script>alert(1)</script>": "&lt;script&gt;alert(1)&lt;/script&gt;",
            '<img src=x onerror="alert(1)">': '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertEqual(headline.render(Context({"title": title})), expected)

        for template_name in (
            "home/components/redesign_card.html",
            "home/components/redesign_story_row.html",
            "home/components/game_analysis_story.html",
            "home/components/bc_election_story_card.html",
            "home/components/bc_election_live_story.html",
        ):
            with self.subTest(template=template_name):
                self.assertIn("title|safe_headline_markup", get_template(template_name).template.source)

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

    def test_bc_elections_homepage_feature_is_opt_in(self):
        homepage = HomePage()
        self.assertFalse(homepage.bc_elections_banner_enabled)
        self.assertFalse(homepage.bc_elections_panel_enabled)
        self.assertIn("home.BCLocalElectionsPage", HomePage.subpage_types)
        self.assertEqual(BCLocalElectionsPage.template, "home/bc_local_elections_page.html")

    def test_bc_provincial_feature_is_opt_in_and_editor_managed(self):
        homepage = HomePage()
        self.assertFalse(homepage.bc_provincial_banner_enabled)
        self.assertFalse(homepage.bc_provincial_panel_enabled)
        self.assertIn("home.BCProvincialElectionsPage", HomePage.subpage_types)
        self.assertEqual(BCProvincialElectionsPage.template, "home/bc_provincial_elections_page.html")
        self.assertEqual(BCProvincialElectionsPage().party_heading, "Party Explainers")
        self.assertEqual(BCProvincialElectionsPage().about_heading, "About the Provincial Elections")

    def test_soccer_championship_has_two_cms_children_and_eleven_match_slots(self):
        homepage = HomePage()
        self.assertFalse(homepage.soccer_championship_banner_enabled)
        self.assertFalse(homepage.soccer_championship_panel_enabled)
        self.assertIn("home.WomensSoccerChampionshipPage", HomePage.subpage_types)
        self.assertEqual(
            WomensSoccerChampionshipPage.subpage_types,
            ["home.WomensSoccerTeamsPage", "home.WomensSoccerMatchesPage"],
        )
        self.assertEqual(WomensSoccerTeamsPage.max_count_per_parent, 1)
        self.assertEqual(WomensSoccerMatchesPage.max_count_per_parent, 1)
        self.assertEqual(len(WomensSoccerMatch.SLOT_CHOICES), 11)

    def test_soccer_data_children_have_previews_without_public_templates(self):
        request = RequestFactory().get("/admin/preview/")
        parent = SimpleNamespace(get_url=lambda _request: "/2026-usports-womens-soccer-championship/")
        for page_class, relation, kind in (
            (WomensSoccerTeamsPage, "teams", "teams"),
            (WomensSoccerMatchesPage, "matches", "matches"),
        ):
            with self.subTest(kind=kind), patch("home.models.render") as render:
                page = SimpleNamespace(get_parent=lambda: parent)
                setattr(page, relation, SimpleNamespace(all=lambda: []))
                page_class.serve_preview(page, request, "")
                self.assertEqual(render.call_args.args[1], "home/womens_soccer_data_preview.html")
                self.assertEqual(render.call_args.args[2]["data_kind"], kind)

    def test_soccer_championship_medals_wait_for_both_final_matches(self):
        teams = [SimpleNamespace(pk=i, seed=i) for i in range(1, 5)]
        gold = SimpleNamespace(slot="gold", home_team=teams[0], away_team=teams[1],
                               winner_id=1, losing_team=teams[1], is_final=True, analysis_id=100)
        bronze = SimpleNamespace(slot="bronze", home_team=teams[2], away_team=teams[3],
                                 winner_id=3, losing_team=teams[3], is_final=False, analysis_id=None)
        rows = [SimpleNamespace(article_id=101, display_label="")]
        page = SimpleNamespace(pk=42, explainers=SimpleNamespace(all=lambda: rows), featured_article_id=None)
        team_page = SimpleNamespace(teams=SimpleNamespace(select_related=lambda *_: SimpleNamespace(order_by=lambda *_: teams)))
        match_page = SimpleNamespace(matches=SimpleNamespace(select_related=lambda *_: [gold, bronze]))
        analysis = SimpleNamespace(pk=100)
        explainer = SimpleNamespace(pk=101)
        with patch("home.models.WomensSoccerTeamsPage.objects") as team_pages, \
                patch("home.models.WomensSoccerMatchesPage.objects") as match_pages, \
                patch("home.models.ArticlePage.objects") as articles:
            team_pages.live.return_value.public.return_value.child_of.return_value.first.return_value = team_page
            match_pages.live.return_value.public.return_value.child_of.return_value.first.return_value = match_page
            articles.live.return_value.public.return_value.filter.return_value.specific.return_value = [analysis, explainer]
            pending = WomensSoccerChampionshipPage.get_championship_content(page)
            self.assertEqual(pending["medals"], {})
            self.assertEqual(len(pending["quarterfinals"]), 4)
            self.assertEqual(len(pending["championship_semifinals"]), 2)
            self.assertEqual(len(pending["consolation_semifinals"]), 2)
            self.assertEqual(len(pending["finals"]), 3)
            self.assertEqual(pending["quarterfinals"][0].short_label, "QF 1")
            self.assertIsNone(pending["quarterfinals"][0].home_team)
            self.assertFalse(pending["quarterfinals"][0].has_score)
            bronze.is_final = True
            complete = WomensSoccerChampionshipPage.get_championship_content(page)
        self.assertEqual(complete["medals"], {1: "gold", 2: "silver", 3: "bronze"})
        self.assertEqual([team.medal for team in complete["teams"]], ["gold", "silver", "bronze", ""])
        self.assertEqual(complete["analyses"], [])

    def test_soccer_panel_story_slots_stay_out_of_chronological_home_stream(self):
        stories = []
        for story_id in range(1, 9):
            story = SimpleNamespace(pk=story_id, story_form="standard")
            story.specific = story
            stories.append(story)
        championship = SimpleNamespace(get_championship_content=lambda: {
            "featured_article": stories[5],
            "explainers": [SimpleNamespace(article=stories[6])],
        })
        homepage = HomePage(
            soccer_championship_page_id=44,
            soccer_championship_panel_enabled=True,
            game_analysis_enabled=False,
        )
        with patch("wagtail.models.Page.get_context", return_value={}), \
                patch.object(homepage, "get_curated_articles", return_value=stories), \
                patch("home.models.WomensSoccerChampionshipPage.objects") as pages, \
                patch("home.models.ArticlePage"), \
                patch("home.models.settings.DEBUG", False):
            pages.live.return_value.public.return_value.filter.return_value.first.return_value = championship
            context = homepage.get_context(RequestFactory().get("/"))
        self.assertEqual([story.pk for story in context["redesign_articles"]], [1, 2, 3, 4, 5, 8])

    def test_soccer_panel_is_limited_to_main_sports_section(self):
        template = get_template("section/section_page.html").template.source
        self.assertIn("section_slug == 'sports' and not redesign_active_beat_id", template)
        self.assertLess(template.index("soccer_champ_panel.html"), template.index('id="redesign-section-feed"'))

    def test_empty_provincial_slots_do_not_query_articles(self):
        class EmptySlots:
            def order_by(self, *_args):
                return []

        page = SimpleNamespace(
            party_explainers=EmptySlots(),
            about_explainers=EmptySlots(),
            featured_article_id=None,
        )
        with patch("home.models.ArticlePage") as articles:
            content = BCProvincialElectionsPage.get_election_content(page)
        articles.objects.live.assert_not_called()
        self.assertEqual(content, {"featured_article": None, "parties": [], "about": []})

    def test_provincial_page_renders_editable_navigation_and_four_column_sections(self):
        template = get_template("home/bc_provincial_elections_page.html").template.source
        self.assertIn('href="#party-explainers">{{ self.party_heading }}', template)
        self.assertIn('href="#about-the-provincial-elections">{{ self.about_heading }}', template)
        self.assertEqual(template.count("bc-election-page__grid--four"), 2)
        self.assertIn("election_content.featured_article", template)
        self.assertNotIn("bc_election_live_story.html", template)

    def test_provincial_panel_preserves_four_then_three_column_order(self):
        template = get_template("home/components/bc_provincial_panel.html").template.source
        self.assertIn("bc_provincial_content.about|slice:':4'", template)
        self.assertIn("bc_provincial_content.about|slice:'4:'", template)
        self.assertIn("bc_provincial_content.parties", template)

    def test_empty_election_slots_do_not_query_articles(self):
        class EmptySlots:
            def order_by(self, *_args):
                return []

            def select_related(self, *_args):
                return self

        page = SimpleNamespace(
            explainers=EmptySlots(),
            vancouver_profiles=EmptySlots(),
            party_profiles=EmptySlots(),
            live_results_article_id=None,
            live_results_ended_at=None,
        )
        with patch("home.models.ArticlePage") as articles:
            content = BCLocalElectionsPage.get_election_content(page, include_metro=False)
        articles.objects.live.assert_not_called()
        self.assertEqual(content["explainers"], [])
        self.assertEqual(content["vancouver"], [])
        self.assertEqual(content["parties"], [])
        self.assertIsNone(content["live_article"])

    def test_visible_election_panel_stories_stay_out_of_below_fold_stream(self):
        stories = []
        for story_id in range(1, 9):
            story = SimpleNamespace(pk=story_id, story_form="standard")
            story.specific = story
            stories.append(story)
        election_content = {
            "explainers": [SimpleNamespace(article=stories[5])],
            "vancouver": [SimpleNamespace(article=stories[6])],
            "parties": [SimpleNamespace(article=stories[7])],
            "live_article": stories[7],
        }
        election_page = SimpleNamespace(get_election_content=lambda **_kwargs: election_content)
        homepage = HomePage(
            bc_elections_page_id=42,
            bc_elections_panel_enabled=True,
            bc_elections_show_vancouver=False,
            game_analysis_enabled=False,
        )
        with patch("wagtail.models.Page.get_context", return_value={}), \
                patch.object(homepage, "get_curated_articles", return_value=stories), \
                patch("home.models.BCLocalElectionsPage.objects") as election_pages, \
                patch("home.models.ArticlePage"), \
                patch("home.models.settings.DEBUG", False):
            election_pages.live.return_value.public.return_value.filter.return_value.first.return_value = election_page
            context = homepage.get_context(RequestFactory().get("/"))

        # The five top-fold stories remain; the visible explainer and party/live
        # story do not. The hidden Vancouver story remains eligible below fold.
        self.assertEqual(
            [story.pk for story in context["redesign_articles"]],
            [1, 2, 3, 4, 5, 7],
        )

    def test_visible_provincial_panel_stories_stay_out_of_below_fold_stream(self):
        stories = []
        for story_id in range(1, 10):
            story = SimpleNamespace(pk=story_id, story_form="standard")
            story.specific = story
            stories.append(story)
        provincial_content = {
            "featured_article": stories[5],
            "parties": [SimpleNamespace(article=stories[6])],
            "about": [SimpleNamespace(article=stories[7])],
        }
        provincial_page = SimpleNamespace(get_election_content=lambda **_kwargs: provincial_content)
        homepage = HomePage(
            bc_provincial_elections_page_id=43,
            bc_provincial_panel_enabled=True,
            game_analysis_enabled=False,
        )
        with patch("wagtail.models.Page.get_context", return_value={}), \
                patch.object(homepage, "get_curated_articles", return_value=stories), \
                patch("home.models.BCProvincialElectionsPage.objects") as election_pages, \
                patch("home.models.ArticlePage"), \
                patch("home.models.settings.DEBUG", False):
            election_pages.live.return_value.public.return_value.filter.return_value.first.return_value = provincial_page
            context = homepage.get_context(RequestFactory().get("/"))
        self.assertEqual([story.pk for story in context["redesign_articles"]], [1, 2, 3, 4, 5, 9])

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


class ThunderbirdCalendarImportTests(TestCase):
    EVENT = "Women's Hockey at University of Manitoba"
    CATEGORY = "Women's Hockey"

    def calendar(self, *games):
        rows = ["Event,Start Date,Start Time,Category,Facility"]
        rows.extend(
            f'"{self.EVENT}",{date},{time},"{self.CATEGORY}",Wayne Fleming Arena'
            for date, time in games
        )
        return BytesIO(("\n".join(rows) + "\n").encode())

    def test_double_header_imports_both_games_and_keeps_scores_on_refresh(self):
        friday = ("10/9/2026", "5:00PM")
        saturday = ("10/10/2026", "11:00AM")
        import_calendar(self.calendar(friday))
        first = ThunderbirdFixture.objects.get()
        first.away_score = 3
        first.home_score = 2
        first.away_scorebug_color = "#7B5B22"
        first.scorebug_stats = [("comparison", {
            "label": "Shots", "away_value": "29", "home_value": "34",
        })]
        first.save()

        # The new game comes first to reproduce the former reconciliation bug:
        # it used to overwrite Friday because Friday was the sole nearby match.
        result = import_calendar(self.calendar(saturday, friday))
        self.assertEqual(result["reconciled"], 0)
        self.assertEqual(ThunderbirdFixture.objects.count(), 2)
        first.refresh_from_db()
        self.assertEqual((first.away_score, first.home_score), (3, 2))
        self.assertEqual(first.away_scorebug_color, "#7B5B22")
        self.assertEqual(first.scorebug_stats[0].value["away_value"], "29")
        self.assertEqual(first.source_event, f"{self.EVENT}|10/9/2026|5:00PM")

        import_calendar(self.calendar(friday, saturday))
        self.assertEqual(ThunderbirdFixture.objects.count(), 2)
        first.refresh_from_db()
        self.assertEqual((first.away_score, first.home_score), (3, 2))

    def test_unambiguous_reschedule_preserves_entered_result(self):
        import_calendar(self.calendar(("10/9/2026", "5:00PM")))
        fixture = ThunderbirdFixture.objects.get()
        fixture.away_score = 4
        fixture.save()

        result = import_calendar(self.calendar(("10/9/2026", "6:00PM")))
        self.assertEqual(result["reconciled"], 1)
        self.assertEqual(ThunderbirdFixture.objects.count(), 1)
        fixture.refresh_from_db()
        self.assertEqual(fixture.away_score, 4)
        self.assertEqual(fixture.source_event, f"{self.EVENT}|10/9/2026|6:00PM")

    def test_volleyball_double_header_keeps_both_home_games(self):
        self.EVENT = "Women's Volleyball vs University of Calgary"
        self.CATEGORY = "Women's Volleyball"
        import_calendar(self.calendar(("10/23/2026", "7:15PM"), ("10/24/2026", "5:45PM")))
        self.assertEqual(ThunderbirdFixture.objects.count(), 2)
        self.assertEqual(
            list(ThunderbirdFixture.objects.order_by("starts_at").values_list("home_name", flat=True)),
            ["UBC Thunderbirds", "UBC Thunderbirds"],
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
