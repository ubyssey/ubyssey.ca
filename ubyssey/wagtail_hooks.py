from urllib.parse import urljoin

from django.conf import settings

from wagtail.core import hooks
from wagtail.contrib.modeladmin.options import (
    ModelAdmin, modeladmin_register)

from dbtemplates.models import Template as DBTemplate
from wagtailmodelchooser import register_model_chooser
from wagtailcache.cache import clear_cache

register_model_chooser(DBTemplate)

class DBTemplateAdmin(ModelAdmin):
    model = DBTemplate
    menu_label = 'Custom HTML'
    menu_icon = 'code'
    menu_order = 800
    list_display = ('name','id','creation_date','last_changed')

modeladmin_register(DBTemplateAdmin)

def match_exact_url(url):
    """Return a regular expression that exactly matches the provided URL."""
    return '^%s$' % url

def get_clear_on_publish():
    """Return the list of URLs to be cleared each time a page is published."""

    if hasattr(settings, 'CACHE_CLEAR_ON_PUBLISH'):
        return [
            urljoin(settings.BASE_URL, url) for url in settings.CACHE_CLEAR_ON_PUBLISH
        ]

    return []

ALWAYS_CLEAR_ON_PUBLISH = get_clear_on_publish()

@hooks.register('after_create_page')
@hooks.register('after_edit_page')
def clear_wagtailcache(request, page):
    """
    Clear URLs from the Wagtail cache when a new or existing page is published.
    This prevents stale pages and ensures that the website is always
    up to date for readers.
    
    URLs to to be cleared:
      - The page itself.
      - Its parent page (usually a section page, e.g. "news").
      - Any pages defined in the CACHE_CLEAR_ON_PUBLISH setting.
    """

    if page.live:

        page_url = page.full_url
        parent_url = page.get_parent().full_url

        urls = [
            match_exact_url(page_url),
            match_exact_url(parent_url)
        ] + ALWAYS_CLEAR_ON_PUBLISH

        clear_cache(urls)
