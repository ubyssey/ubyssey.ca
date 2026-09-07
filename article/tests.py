from django.test import SimpleTestCase
from types import SimpleNamespace

from article.models import StandardArticlePage
from article.templatetags.articletags import format_redesign_extended_byline
from article.views import _author_fixture, _fixture_credit_contributors, _sample_story


class ArticleRedesignMappingTests(SimpleTestCase):
    def test_legacy_header_layouts_map_to_redesign_variants(self):
        expected = {
            "bottom-image": "big-centered",
            "top-image": "body-width",
            "left-image": "left-aligned",
            "right-image": "right-aligned",
            "banner-image": "full-bleed",
            "banner-image--full-height--headline-left--headline-bottom": "right-full-bleed",
            "banner-image--full-height--headline-right--headline-bottom": "left-full-bleed",
            "no-image": "body-width",
        }
        for legacy, redesign in expected.items():
            with self.subTest(legacy=legacy):
                self.assertEqual(StandardArticlePage.redesign_layout_for_header(legacy), redesign)

    def test_frequently_used_legacy_right_column_uses_redesign_shell(self):
        article = SimpleNamespace(layout="right-column", use_default_template=True, db_template=None)
        self.assertEqual(StandardArticlePage.get_template(article, None), "article/article_page.html")

    def test_fixture_story_routes_to_its_real_content(self):
        story, directory = _sample_story("centre-for-accessibility-ai-notetaker")
        self.assertEqual(directory, "section-news")
        self.assertIn("Genio", story["headline"])

    def test_fixture_author_uses_matching_local_profile(self):
        author = _author_fixture("Juan Pablo Sastoque Vega")
        self.assertIn("political science", author["bio"])
        self.assertIn("person-06-juan-pablo", author["image_url"])

    def test_extended_byline_uses_editorial_sentence_grammar(self):
        def contributor(name, role):
            return SimpleNamespace(
                author=SimpleNamespace(full_name=name, url=f"/authors/{name.lower().replace(' ', '-')}/"),
                author_alias="",
                author_role=role,
            )

        rendered = str(format_redesign_extended_byline([
            contributor("Elena Massing", "backfield_editor"),
            contributor("Aleah Kippan", "photographer"),
        ]))
        self.assertIn("Elena Massing</a> was this story's backfield editor for this story.", rendered)
        self.assertIn("Aleah Kippan</a> took the photos.", rendered)

    def test_extended_byline_combines_photo_and_graphics_editors(self):
        def contributor(name, role):
            return SimpleNamespace(
                author=SimpleNamespace(full_name=name, url=f"/authors/{name.lower().replace(' ', '-')}/"),
                author_alias="",
                author_role=role,
            )

        rendered = str(format_redesign_extended_byline([
            contributor("Aleah Kippan", "photographer"),
            contributor("Sophia Clearwater", "photo_editor"),
            contributor("Skye Shen", "illustrator"),
            contributor("Quyen Schroeder", "graphics_editor"),
        ]))
        self.assertIn("Aleah Kippan</a> took the photos, which were edited by <a href=\"/authors/sophia-clearwater/\">Sophia Clearwater</a>.", rendered)
        self.assertIn("Skye Shen</a> created the graphics, which were edited by <a href=\"/authors/quyen-schroeder/\">Quyen Schroeder</a>.", rendered)

    def test_scraped_credit_parser_does_not_treat_coauthors_as_photographers(self):
        story, _ = _sample_story("council-new-approach-deliberation")
        credits = _fixture_credit_contributors(story)
        self.assertEqual([credit.author.full_name for credit in credits], ["Quyen Schroeder"])
        self.assertEqual(credits[0].author_role, "photographer")
