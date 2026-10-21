from types import SimpleNamespace
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import RequestFactory, SimpleTestCase

from liveblog.models import LiveBlogArticlePage, LiveBlogUpdateAuthorBlock


class LiveBlogPageTests(SimpleTestCase):
    def test_default_redesign_header_layout(self):
        self.assertEqual(LiveBlogArticlePage().redesign_header_layout, 'big-centered')

    def test_header_info_does_not_require_standard_article_header(self):
        page = SimpleNamespace(
            featured_media=SimpleNamespace(first=lambda: None),
            redesign_header_layout='big-centered',
            title='Election updates',
            current_section=None,
            category_page=None,
        )

        header = LiveBlogArticlePage.get_redesign_header_info(page)

        self.assertEqual(header['layout'], 'big-centered')
        self.assertEqual(header['title'], 'Election updates')
        self.assertEqual(header['image_url'], '')


class LiveBlogBylineTests(SimpleTestCase):
    def test_byline_without_primary_author_still_renders_share_controls(self):
        article = SimpleNamespace(
            title='Live election results',
            primary_author_orderables=[],
        )
        request = RequestFactory().get('/news/live-election-results/')

        html = render_to_string(
            'article/objects/redesign_main_byline.html',
            {'article': article, 'request': request},
        )

        self.assertIn('class="ar-share"', html)
        self.assertNotIn('class="ar-main-byline__card', html)


class LiveBlogUpdateAuthorBlockTests(SimpleTestCase):
    def test_empty_update_role_uses_the_author_page_role(self):
        author = SimpleNamespace(
            image=None,
            full_url='/authors/test-author/',
            full_name='Test Author',
            ubyssey_role='News Editor',
        )
        block = LiveBlogUpdateAuthorBlock()

        with patch.object(
            block,
            'to_python',
            return_value={'author': author, 'author_role': ''},
        ):
            result = block.jsonFormat({})

        self.assertEqual(result['author_role'], 'News Editor')

    def test_explicit_update_role_takes_precedence(self):
        author = SimpleNamespace(
            image=None,
            full_url='/authors/test-author/',
            full_name='Test Author',
            ubyssey_role='News Editor',
        )
        block = LiveBlogUpdateAuthorBlock()

        with patch.object(
            block,
            'to_python',
            return_value={'author': author, 'author_role': 'Live Reporter'},
        ):
            result = block.jsonFormat({})

        self.assertEqual(result['author_role'], 'Live Reporter')
