from django.conf import settings
from django.urls import include, path, re_path
from django.conf.urls.static import static
from django.contrib.staticfiles.views import serve as serve_static

from dispatch.urls import admin_urls, api_urls, podcasts_urls
from newsletter.urls import urlpatterns as newsletter_urls

from ubyssey.views.feed import FrontpageFeed, SectionFeed
from ubyssey.views.main import ads_txt, decorrupt, UbysseyTheme, HomePageView, ArticleView, SectionView, SubsectionView, VideoView, PageView, PodcastView, ArticleAjaxView, AuthorView, ArchiveView
from ubyssey.views.guide import guide2016, GuideArticleView, GuideLandingView

from ubyssey.views.advertise import AdvertiseTheme
from ubyssey.views.magazine import magazine

from ubyssey.zones import *
from ubyssey.widgets import *
from ubyssey.templates import *

from ubyssey.events.api.urls import urlpatterns as event_api_urls
from ubyssey.events.urls import urlpatterns as events_urls

from django.views.generic import TemplateView

from wagtail.admin import urls as wagtailadmin_urls
from wagtail.core import urls as wagtail_urls
from wagtail.documents import urls as wagtaildocs_urls

theme = UbysseyTheme()
advertise = AdvertiseTheme()

urlpatterns = []

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
    ]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    #For Google Adsense, because of our serverless setup with GCP
    path(settings.SECRET_URL,decorrupt,name='decorrupt'),

    re_path(r'^ads.txt$',ads_txt,name='ads-txt'),

    # Wagtail
    path('cms/', include(wagtailadmin_urls)),
    path('documents/', include(wagtaildocs_urls)),
    path('pages/', include(wagtail_urls)),

    re_path(r'^admin', include(admin_urls)),
    re_path(r'^api/', include(api_urls)),
    re_path(r'^podcasts/', include(podcasts_urls)),
    re_path(r'^newsletter/', include(newsletter_urls)),

    re_path(r'^$', HomePageView.as_view(), name='home'),
    re_path(r'^search/$', ArchiveView.as_view(), name='search'), #to preserve URL but get rid of tiny redirect view
    re_path(r'^archive/$', ArchiveView.as_view(), name='archive'),
    re_path(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),

    # Page views that have been grandfathered in to having special URLs as permalink
    re_path(r'^(?P<slug>about)/$', PageView.as_view(), name='about'),
    re_path(r'^(?P<slug>volunteer)/$', PageView.as_view(), name='volunteer'),
    re_path(r'^(?P<slug>advice)/$', PageView.as_view(), name='advice'),
    re_path(r'^(?P<slug>submit-an-opinion)/$', PageView.as_view(), name='submit-an-opinion'),

    # Other pages
    re_path(r'^page/(?P<slug>[-\w]+)/$', PageView.as_view(), name='page'),

    re_path(r'^(?P<slug>[-\w]+)/rss/$', SectionFeed(), name='section-feed'),
    re_path(r'^authors/(?P<slug>[-\w]+)/$', AuthorView.as_view(), name='author'),

    # Guide to UBC
    re_path(r'^guide/2016/$', guide2016.landing, name='guide-landing-2016'),
    re_path(r'^guide/2016/(?P<slug>[-\w]+)/$', guide2016.article, name='guide-article-2016'),

    re_path(r'^guide/(?P<year>[0-9]{4})/$', GuideLandingView.as_view(), name='guide-landing'),
    re_path(r'^guide/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/$', GuideLandingView.as_view(), name='guide-landing-sub'),
    re_path(r'^guide/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/(?P<slug>[-\w]+)/$', GuideArticleView.as_view(), name='guide-article'),

    # Magazine
    re_path(r'^magazine/(?P<year>[0-9]{4})/$', magazine.magazine, name='magazine-landing'),
    re_path(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    # Advertising
    re_path(r'^advertise/$', advertise.new, name='advertise-new'),

    # Centennial
    re_path(r'^100/$', UbysseyTheme.centennial, name='centennial-landing'), #was for special 2018 event. Consider removing.

    # Beta-features
    # re_path(r'^beta/notifications/$', theme.notification, name='notification-beta'),

    # Podcasts
    re_path(r'^podcast/(?P<slug>[-\w]+)', PodcastView.as_view(), name='podcasts'),

    # Events
    re_path(r'^events/', include(events_urls)),
    re_path(r'^api/events/', include(event_api_urls)),

    # Videos
    re_path(r'^videos/', VideoView.as_view(), name='videos'),

    # Subsections
    re_path(r'^subsection/(?P<slug>[-\w]+)/$', SubsectionView.as_view(), name='subsection'), #Dislike this, 

    re_path(r'^(?P<section>[-\w]+)/(?P<slug>[-\w]+)/$', ArticleView.as_view(), name='article'),
    re_path(r'^(?P<slug>[-\w]+)/$', SectionView.as_view(), name='section'),
    re_path(r'^api/articles/(?P<pk>[0-9]+)/rendered/$', ArticleAjaxView.as_view(), name='article-ajax'),
    
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

