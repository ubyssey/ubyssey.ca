from django.conf import settings
from django.conf.urls import include, url
from django.conf.urls.static import static
from django.shortcuts import render_to_response

from dispatch.admin import urls as admin_urls
from dispatch.api import urls as api_urls

from ubyssey.views.feed import FrontpageFeed, SectionFeed
from ubyssey.views.main import UbysseyTheme
from ubyssey.views.guide import GuideTheme
from ubyssey.views.magazine import MagazineTheme
from ubyssey.views.advertise import AdvertiseTheme

from ubyssey.zones import *
from ubyssey.widgets import *
from ubyssey.templates import *

from ubyssey.events.api.urls import urlpatterns as event_api_urls
from ubyssey.events.urls import urlpatterns as events_urls

theme = UbysseyTheme()
guide = GuideTheme()
magazine = MagazineTheme()
advertise = AdvertiseTheme()

urlpatterns = [
    url(r'^admin', include(admin_urls)),
    url(r'^api/', include(api_urls)),

    url(r'^$', theme.home, name='home'),
    url(r'^search/$', theme.search, name='search'),
    url(r'^archive/$', theme.archive, name='archive'),
    url(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),

    url(r'^(?P<slug>[-\w]+)/rss/$', SectionFeed(), name='section-feed'),
    url(r'^authors/(?P<slug>[-\w]+)/$', theme.author, name='author'),
    url(r'^topic/(\d*)/$', theme.topic, name='topic'),

    # Guide to UBC
    url(r'^guide/$', guide.landing, name='guide-landing'),
    url(r'^guide/(?P<slug>[-\w]+)/$', guide.article, name='guide-article'),

    # Magazine
    url(r'^magazine/$', magazine.landing, name='magazine-landing'),
    url(r'^magazine/2017/$', magazine.landing_2017, name='magazine-landing-2017'),
    url(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    # Advertising
    url(r'^advertise/$', advertise.landing, name='advertise-landing'),

    # Elections
    url(r'^elections/$', theme.elections, name='elections'),

    # Centennial
    url(r'^100/$', theme.centennial, name='centennial-landing'),

    # Events
    url(r'^events/', include(events_urls)),
    url(r'^api/events/', include(event_api_urls)),

    url(r'^(?P<section>[-\w]+)/(?P<slug>[-\w]+)/$', theme.article, name='article'),
    url(r'^(?P<slug>[-\w]+)/$', theme.section, name='page'),
    url(r'^api/articles/(?P<pk>[0-9]+)/rendered/$', theme.article_ajax, name='article-ajax'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
