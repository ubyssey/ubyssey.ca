from django.test import SimpleTestCase
from types import SimpleNamespace

from article.models import StandardArticlePage


class ArticleRedesignMappingTests(SimpleTestCase):
    def test_legacy_header_layouts_map_to_redesign_variants(self):
        expected = {
            "bottom-image": "big-centered",
            "top-image": "body-width",
            "left-image": "left-aligned",
            "right-image": "right-aligned",
            "banner-image": "full-bleed",
            "banner-image--full-height--headline-left--headline-bottom": "full-bleed",
            "no-image": "body-width",
        }
        for legacy, redesign in expected.items():
            with self.subTest(legacy=legacy):
                self.assertEqual(StandardArticlePage.redesign_layout_for_header(legacy), redesign)

    def test_story_type_description_uses_editorial_glossary(self):
        self.assertIn("immediate relevance", StandardArticlePage.STORY_TYPE_DEFINITIONS["report"])

    def test_frequently_used_legacy_right_column_uses_redesign_shell(self):
        article = SimpleNamespace(layout="right-column", use_default_template=True, db_template=None)
        self.assertEqual(StandardArticlePage.get_template(article, None), "article/article_page.html")
