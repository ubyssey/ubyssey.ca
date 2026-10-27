from django.template.loader import render_to_string
from django.test import SimpleTestCase
from types import SimpleNamespace

from article.models import ArticleFeaturedMediaOrderable, ArticlePage, StandardArticlePage
from article.video_header import supported_video_file, youtube_embed_url, youtube_video_id
from article.templatetags.articletags import format_redesign_extended_byline, normalize_redesign_byline
from article.views import _author_fixture, _fixture_credit_contributors, _sample_story


class ArticleRedesignMappingTests(SimpleTestCase):
    def test_full_bleed_video_header_is_available_in_the_editor(self):
        panel = next(
            panel for panel in StandardArticlePage.content_panels
            if getattr(panel, "heading", None) == "Full-bleed video header"
        )
        fields = [child.field_name for child in panel.children]
        self.assertEqual(fields, [
            "video_header_enabled", "video_preview_file", "video_preview_youtube_url",
            "video_full_file", "video_full_youtube_url",
        ])

    def test_video_header_uses_existing_full_bleed_layout(self):
        article = SimpleNamespace(video_header_enabled=True)
        self.assertEqual(StandardArticlePage.redesign_header_layout.fget(article), "full-bleed")

    def test_youtube_header_links_are_restricted_to_youtube(self):
        video_id = "dQw4w9WgXcQ"
        for url in (
            f"https://www.youtube.com/watch?v={video_id}",
            f"https://youtu.be/{video_id}",
            f"https://www.youtube.com/live/{video_id}",
            f"https://www.youtube-nocookie.com/embed/{video_id}",
        ):
            with self.subTest(url=url):
                self.assertEqual(youtube_video_id(url), video_id)
        self.assertIsNone(youtube_video_id(f"https://youtube.com.evil.example/watch?v={video_id}"))
        self.assertIsNone(youtube_video_id("https://www.youtube.com/watch?v=invalid"))
        self.assertIn("mute=1&loop=1&playlist=", youtube_embed_url(f"https://youtu.be/{video_id}", preview=True))
        self.assertNotIn("mute=1", youtube_embed_url(f"https://youtu.be/{video_id}"))

    def test_native_header_uploads_use_browser_video_formats(self):
        self.assertTrue(supported_video_file(SimpleNamespace(file=SimpleNamespace(name="headers/preview.MP4"))))
        self.assertTrue(supported_video_file(SimpleNamespace(file=SimpleNamespace(name="headers/full.webm"))))
        self.assertFalse(supported_video_file(SimpleNamespace(file=SimpleNamespace(name="headers/full.mov"))))

    def test_video_hero_renders_youtube_preview_and_fullscreen_control(self):
        featured = SimpleNamespace(image=None, alt_text="", cover_caption="", credit="")
        article = SimpleNamespace(
            featured_media=SimpleNamespace(first=lambda: featured),
            header=[SimpleNamespace(value={})],
            redesign_header_layout="full-bleed", video_header_enabled=True,
            current_section="News", category_page=None, title="Video story", lede="",
            video_preview_youtube_url="https://youtu.be/dQw4w9WgXcQ",
            video_preview_embed_url=youtube_embed_url("https://youtu.be/dQw4w9WgXcQ", preview=True),
            video_full_youtube_url="https://youtu.be/dQw4w9WgXcQ",
            video_full_embed_url=youtube_embed_url("https://youtu.be/dQw4w9WgXcQ"),
        )
        rendered = render_to_string("article/components/redesign_hero.html", {"article": article})
        self.assertIn("data-video-preview", rendered)
        self.assertIn("data-video-open", rendered)
        self.assertIn("data-video-player", rendered)
        self.assertIn("data-full-video-kind=\"youtube\"", rendered)
        self.assertIn('referrerpolicy="strict-origin-when-cross-origin"', rendered)

    def test_standard_article_editor_exposes_covered_sport(self):
        front_page = next(
            panel for panel in StandardArticlePage.content_panels
            if getattr(panel, "heading", None) == "Front Page Stuff"
        )
        self.assertIn(
            "covered_sport",
            [panel.field_name for panel in front_page.children if hasattr(panel, "field_name")],
        )

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
        self.assertIn("Elena Massing</a> was this story's backfield editor.", rendered)
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

    def test_extended_byline_includes_videographers_and_designers(self):
        def contributor(name, role):
            return SimpleNamespace(
                author=SimpleNamespace(full_name=name, url=f"/authors/{name.lower().replace(' ', '-')}/"),
                author_alias="",
                author_role=role,
            )

        rendered = str(format_redesign_extended_byline([
            contributor("Ari Video", "videographer"),
            contributor("Dee Sign", "designer"),
        ]))
        self.assertIn("Ari Video</a> was the videographer.", rendered)
        self.assertIn("Dee Sign</a> designed this article.", rendered)

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

    def test_compact_card_byline_omits_visual_role_labels(self):
        byline = 'Reporter with photos by <a href="/authors/photo/">Photo Person</a>, illustrations by <a href="/authors/artist/">Artist Person</a>'

        rendered = normalize_redesign_byline(byline)

        self.assertEqual(
            rendered,
            'Reporter with <a href="/authors/photo/">Photo Person</a>, <a href="/authors/artist/">Artist Person</a>',
        )

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
