from typing import Any, Dict
from django.contrib.syndication.views import Feed
from django.utils import feedgenerator
from bs4 import BeautifulSoup

from article.models import ArticlePage
from section.models import SectionPage
from authors.models import AuthorPage

class RssFeedWithImage(feedgenerator.Rss201rev2Feed):
    content_type = "text/xml"

    def add_root_elements(self, handler):
        handler.addQuickElement("title", self.feed['title'])
        handler.addQuickElement("link", self.feed['link'])
        handler.addQuickElement("description", self.feed['description'])

        if self.feed['feed_url'] is not None:
            handler.addQuickElement("atom:link", None, {"rel": "self", "href": self.feed['feed_url']})

        if self.feed['language'] is not None:
            handler.addQuickElement("language", self.feed['language'])

        for cat in self.feed['categories']:
            handler.addQuickElement("category", cat)

        if self.feed['feed_copyright'] is not None:
            handler.addQuickElement("copyright", self.feed['feed_copyright'])

        handler.addQuickElement("lastBuildDate", feedgenerator.rfc2822_date(self.latest_post_date()))

        if self.feed['ttl'] is not None:
            handler.addQuickElement("ttl", self.feed['ttl'])
            
        if self.feed['image_url'] is not None:
            handler.startElement('image',{})
            handler.addQuickElement("url", self.feed['image_url'])
            if self.feed['image_title'] is not None:
                handler.addQuickElement("title", self.feed['image_title'])
            if self.feed['image_link'] is not None:
                handler.addQuickElement("link", self.feed['image_link'])
            handler.endElement("image")

class UbysseyArticleFeed(Feed):
    title = 'The Ubyssey'
    link = 'https://ubyssey.ca'
    description = "From your friends at The Ubyssey"
    feed_url = 'https://ubyssey.ca/rss'

    feed_type = RssFeedWithImage

    def __init__(self, max_items=10):
        self.max_items = max_items

    def feed_extra_kwargs(self, obj):
        '''
        Adding details for the feed logo
        '''
        return {
            "image_url": 'https://www.ubyssey.ca/static/ubyssey/images/ubyssey-logo-square.7fdeb5ac7f29.png',
            "image_title": 'Ubyssey Logo',
            "image_link": 'https://ubyssey.ca'}

    def items(self, section):
        return ArticlePage.objects.live().public().order_by('-explicit_published_at')[:self.max_items]
        # .get_frontpage(limit=self.max_items)

    def item_title(self, item):
        return BeautifulSoup(item.title, "html.parser").get_text()

    def item_pubdate(self, item):
        return item.explicit_published_at

    description_template = "rssdescription.html"

    def get_context_data(self, item=None, **kwargs: Any) -> Dict[str, Any]:
        context = super().get_context_data(**kwargs)

        context["item"] = item

        return context

    def item_author_name(self, item):
        return item.get_authors_string()

    def item_link(self, item):
        return item.get_full_url()
    
class FrontpageFeed(UbysseyArticleFeed):

    title = 'The Ubyssey'
    link = 'https://ubyssey.ca'
    description = "From your friends at The Ubyssey"
    feed_url = 'https://ubyssey.ca/rss'

    feed_type = RssFeedWithImage

    def items(self, section):
        return ArticlePage.objects.live().public().order_by('-explicit_published_at')[:self.max_items]
        # .get_frontpage(limit=self.max_items)

class SectionFeed(UbysseyArticleFeed):

    def __init__(self, max_items=10):
        self.max_items = max_items

    def get_object(self, request, slug):
        return SectionPage.objects.get(slug=slug)

    def title(self, section):
        return 'Ubyssey %s' % section.title

    def description(self, section):
        return 'From your friends at The Ubyssey %s' % section.title

    def link(self, section):
        return section.get_full_url()
    
    def feed_url(self, section):
        return 'https://ubyssey.ca/rss/%s' % section.slug

    def items(self, section):
        return ArticlePage.objects.live().public().descendant_of(section).order_by('-explicit_published_at')[:self.max_items]
    
class AuthorFeed(UbysseyArticleFeed):

    def __init__(self, max_items=10):
        self.max_items = max_items

    def get_object(self, request, slug):
        return AuthorPage.objects.get(slug=slug)

    def title(self, author):
        return 'Stories from %s at The Ubyssey' % author.full_name

    def description(self, author):
        return author.bio_description
    
    def link(self, author):
        return author.get_full_url()
    
    def feed_url(self, author):
        return 'https://ubyssey.ca/authors/%s/rss/' % author.slug

    def items(self, author):
        return ArticlePage.objects.live().public().filter(article_authors__author=author).order_by('-explicit_published_at')[:self.max_items]