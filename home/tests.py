from django.template.loader import get_template
from django.test import SimpleTestCase

from home.blocks import GameAnalysisPanel


class HomepageRedesignTests(SimpleTestCase):
    def test_redesign_templates_compile(self):
        templates = [
            "home/home_page.html",
            "home/components/redesign_nav.html",
            "home/components/redesign_card.html",
            "home/components/redesign_story_row.html",
            "home/stream_blocks/game_analysis.html",
        ]
        for template_name in templates:
            with self.subTest(template=template_name):
                self.assertIsNotNone(get_template(template_name))

    def test_game_analysis_panel_exposes_editorial_fields(self):
        self.assertEqual(
            set(GameAnalysisPanel().child_blocks),
            {"active_sports", "articles", "upcoming_games", "recent_results"},
        )
