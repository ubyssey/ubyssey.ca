from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from liveblog.models import LiveBlogUpdateAuthorBlock


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
