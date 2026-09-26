from django.core.cache import cache
from django.db import transaction
from django.dispatch import receiver

from wagtail.signals import page_published, page_unpublished

from article.models import ArticlePage
from archive.models import PUBLISHED_YEARS_CACHE_KEY


@receiver(page_published)
@receiver(page_unpublished)
def invalidate_published_years(sender, **kwargs):
    """Refresh archive year filters after article visibility changes."""
    if issubclass(sender, ArticlePage):
        transaction.on_commit(lambda: cache.delete(PUBLISHED_YEARS_CACHE_KEY))
