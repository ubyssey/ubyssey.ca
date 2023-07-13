from django.contrib.syndication.views import Feed
from django.urls import reverse

from dispatch.models import Section, Article

from ubyssey.helpers import ArticleHelper

class SectionFeed(Feed):

    def __init__(self, max_items=10):
        self.max_items = max_items

    def get_object(self, request, slug):
        return Section.objects.get(name=slug)

    def title(self, section):
        return 'Ubyssey %s' % section.name

    def description(self, section):
        return 'Daily updates from Ubyssey %s' % section.name

    def link(self, section):
        return '/%s/' % section.slug

    def items(self, section):
        return Article.objects.filter(section=section, is_published=True).order_by('-published_at')[:self.max_items]

    def item_title(self, item):
        return item.headline

    def item_pubdate(self, item):
        return item.published_at

    def item_description(self, item):
        return item.snippet

    def item_author_name(self, item):
        return item.get_author_string()

    def item_link(self, item):
        return reverse('article', args=[item.section.slug, item.slug])

class FrontpageFeed(Feed):

    title = 'The Ubyssey'
    link = '/'
    description = 'Daily updates from The Ubyssey'

    def __init__(self, max_items=10):
        self.max_items = max_items

    def items(self, section):
        return ArticleHelper.get_frontpage(limit=self.max_items)

    def item_title(self, item):
        return item.headline

    def item_pubdate(self, item):
        return item.published_at

    def item_description(self, item):
        return item.snippet

    def item_author_name(self, item):
        return item.get_author_string()

    def item_link(self, item):
        return reverse('article', args=[item.section.slug, item.slug])
