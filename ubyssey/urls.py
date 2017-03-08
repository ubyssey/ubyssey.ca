from django.conf import settings
from django.conf.urls import include, url
from django.conf.urls.static import static

from feed import FrontpageFeed, SectionFeed
from views import UbysseyTheme, UbysseyMagazineTheme

theme = UbysseyTheme()
magazine = UbysseyMagazineTheme()

theme_urls = [
    url(r'^$', theme.home, name='home'),
    url(r'^search/$', theme.search, name='search'),
    url(r'^archive/$', theme.archive, name='archive'),
    url(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),
    url(r'^(?P<slug>[-\w]+)/rss/$', SectionFeed(), name='section-feed'),
    url(r'^author/(?P<slug>[-\w]+)/articles/$', theme.author_articles, name='author-articles'),
    url(r'^author/(?P<slug>[-\w]+)/$', theme.author, name='author'),
    url(r'^topic/(\d*)/$', theme.topic, name='topic'),
    url(r'^guide/$', theme.guide_index, name='guide-index'),
    url(r'^guide/(?P<slug>[-\w]+)/$', theme.guide_article, name='guide-article'),

    # Magazine URLs
    url(r'^magazine/$', magazine.landing, name='magazine-landing'),
    url(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    # Elections
    url(r'^elections/$', theme.elections, name='elections'),

    url(r'^(?P<section>[-\w]+)/(?P<slug>[-\w]+)/$', theme.article, name='article'),
    url(r'^(?P<slug>[-\w]+)/$', theme.section, name='page'),
    url(r'^api/articles/(?P<pk>[0-9]+)/rendered/$', theme.article_ajax, name='article-ajax')
]

if settings.DEBUG:
    theme_urls += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
