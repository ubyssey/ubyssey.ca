from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from archive.models import ArchivePage, PUBLISHED_YEARS_CACHE_KEY
from archive.signals import invalidate_published_years
from article.models import ArticlePage, StandardArticlePage
from article.templatetags.articletags import redesign_card_byline


class ArchiveYearCacheTests(SimpleTestCase):
    def setUp(self):
        cache.delete(PUBLISHED_YEARS_CACHE_KEY)

    def tearDown(self):
        cache.delete(PUBLISHED_YEARS_CACHE_KEY)

    def test_years_are_shared_until_the_cache_is_invalidated(self):
        archive = ArchivePage()
        with patch("archive.models.ArticlePage.objects.live") as live:
            live.return_value.dates.return_value = [date(2026, 1, 1), date(2025, 1, 1)]

            self.assertEqual(archive._ArchivePage__get_years(), [2026, 2025])
            self.assertEqual(archive._ArchivePage__get_years(), [2026, 2025])
            live.return_value.dates.assert_called_once_with(
                "explicit_published_at", "year", order="DESC"
            )

            cache.delete(PUBLISHED_YEARS_CACHE_KEY)
            self.assertEqual(archive._ArchivePage__get_years(), [2026, 2025])
            self.assertEqual(live.return_value.dates.call_count, 2)

    def test_article_publication_invalidates_cached_years_after_commit(self):
        with patch(
            "archive.signals.transaction.on_commit",
            side_effect=lambda callback: callback(),
        ), patch("archive.signals.cache.delete") as delete:
            invalidate_published_years(sender=StandardArticlePage)
            delete.assert_called_once_with(PUBLISHED_YEARS_CACHE_KEY)

    def test_non_article_publication_does_not_invalidate_cached_years(self):
        with patch("archive.signals.transaction.on_commit") as on_commit:
            invalidate_published_years(sender=ArchivePage)
            on_commit.assert_not_called()


class _PrefetchedAuthors:
    def __init__(self, contributors):
        self.contributors = contributors
        self.all_calls = 0

    def all(self):
        self.all_calls += 1
        return self.contributors

    def filter(self, **kwargs):
        raise AssertionError("Card bylines must use prefetched authors")


class _ArticleCard:
    def __init__(self, contributors):
        self.article_authors = _PrefetchedAuthors(contributors)

    @property
    def specific(self):
        raise AssertionError("Card bylines must not resolve the specific page")

    def get_authors_string(self, *args, **kwargs):
        return ArticlePage.get_authors_string(self, *args, **kwargs)


class ArchiveCardBylineTests(SimpleTestCase):
    def contributor(self, role, name):
        return SimpleNamespace(
            author_role=role,
            author_alias="",
            author=SimpleNamespace(
                id=name,
                full_name=name,
                full_url=f"/contributors/{name.lower().replace(' ', '-')}/",
                live=True,
            ),
        )

    def test_reporters_are_linked_without_resolving_each_page(self):
        article = _ArticleCard(
            [
                self.contributor("photographer", "Photo Editor"),
                self.contributor("author", "Reporter One"),
                self.contributor("author", "Reporter Two"),
            ]
        )

        byline = redesign_card_byline(article)

        self.assertIn("Reporter One", byline)
        self.assertIn("Reporter Two", byline)
        self.assertNotIn("Photo Editor", byline)
        self.assertIn('/contributors/reporter-one/', byline)
        self.assertEqual(article.article_authors.all_calls, 1)

    def test_legacy_story_without_reporter_uses_first_contributor(self):
        article = _ArticleCard(
            [
                self.contributor("photographer", "First Contributor"),
                self.contributor("editor", "Second Contributor"),
            ]
        )

        byline = redesign_card_byline(article)

        self.assertIn("First Contributor", byline)
        self.assertNotIn("Second Contributor", byline)
        self.assertEqual(article.article_authors.all_calls, 1)

    def test_preview_byline_does_not_require_article_relations(self):
        self.assertEqual(
            redesign_card_byline(SimpleNamespace(preview_byline="Preview Writer")),
            "Preview Writer",
        )
