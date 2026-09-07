from django.template.loader import render_to_string
from django.test import SimpleTestCase
from types import SimpleNamespace

from article.models import ArticleFeaturedMediaOrderable, ArticlePage, StandardArticlePage
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

    def test_story_type_description_uses_editorial_glossary(self):
        self.assertIn("immediate relevance", StandardArticlePage.STORY_TYPE_DEFINITIONS["report"])

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

    def test_legacy_visual_byline_excludes_photo_and_graphics_editors(self):
        class Contributors:
            def __init__(self, contributors):
                self.contributors = contributors

            def all(self):
                return self.contributors

        reporter = SimpleNamespace(author=SimpleNamespace(full_name="Reporter"), author_role="author")
        photo_editor = SimpleNamespace(author=SimpleNamespace(full_name="Photo Editor"), author_role="photo_editor")
        graphics_editor = SimpleNamespace(author=SimpleNamespace(full_name="Graphics Editor"), author_role="graphics_editor")
        article = SimpleNamespace(
            article_authors=Contributors([reporter, photo_editor, graphics_editor]),
            get_authors_string=lambda **kwargs: ", ".join(author.author.full_name for author in kwargs["authors_list"]),
        )

        self.assertEqual(ArticlePage.get_authors_split_out_visual_bylines(article).strip(), "Reporter")

    def test_story_form_uses_the_approved_statement_and_is_opt_in(self):
        report = SimpleNamespace(story_form="report")
        unclassified = SimpleNamespace(story_form="")

        self.assertEqual(
            StandardArticlePage.story_form_statement.fget(report),
            "This article is a news report, which we define as a shorter story about events with immediate relevance, written from a detached perspective.",
        )
        self.assertEqual(StandardArticlePage.story_form_statement.fget(unclassified), "")

    def test_empty_metadata_does_not_render_an_empty_context_rail_box(self):
        article = SimpleNamespace(
            story_form_statement="",
            standpoint_disclosure="",
            extended_byline_override="",
            extended_contributors=[],
        )

        rendered = render_to_string("article/objects/redesign_context_rail.html", {"article": article})
        self.assertNotIn("Extended Byline", rendered)
        self.assertNotIn("Standpoint Statement", rendered)

    def test_cover_caption_is_a_separate_empty_by_default_field(self):
        field = ArticleFeaturedMediaOrderable._meta.get_field("cover_caption")
        self.assertEqual(field.default, "")
        self.assertIn("Existing legacy captions are not shown", field.help_text)

    def test_scraped_credit_parser_does_not_treat_coauthors_as_photographers(self):
        story, _ = _sample_story("council-new-approach-deliberation")
        credits = _fixture_credit_contributors(story)
        self.assertEqual([credit.author.full_name for credit in credits], ["Quyen Schroeder"])
        self.assertEqual(credits[0].author_role, "photographer")
