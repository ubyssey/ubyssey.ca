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
    return '%s$' % url

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

        # Use a set to avoid passing duplicate URLs to the
        # clear_cache method.
        urls = set()

        urls.add(match_exact_url(page_url))

        if parent_url:
            urls.add(match_exact_url(parent_url))

        for url in settings.CACHE_CLEAR_ON_PUBLISH:
            # The clear_cache method expects absolute URLs,
            # so convert all relative URLs to absolute based
            # on the current request URL
            abs_url = request.build_absolute_uri(url)

            urls.add(abs_url)

        clear_cache(list(urls))
