from django.conf import settings
from django.urls import include, path, re_path
from django.conf.urls.static import static
from django.contrib import admin
from django.views import defaults as default_views

from wagtail.admin import urls as wagtailadmin_urls
from wagtail import urls as wagtail_urls
from wagtail.documents import urls as wagtaildocs_urls
from wagtail.contrib.sitemaps.views import sitemap

from ubyssey.views.main import ads_txt, redirect_blog_to_humour
from ubyssey.views.feed import FrontpageFeed, SectionFeed, AuthorFeed, TagFeed
from ubyssey.views.advertise import AdvertiseTheme
from ubyssey.views.tag import TagPage

from infinitefeed.views import infinitefeed

from newsletter.urls import urlpatterns as newsletter_urls
from django.conf.urls import handler500

handler500 = 'ubyssey.views.main.custom_500'

advertise = AdvertiseTheme()
tag = TagPage()

urlpatterns = []


if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
        # tricks for testing error page, which is otherwise not viewable with DEBUG on. inspired by https://spapas.github.io/2015/04/29/django-show-404-page/ (which is outdated)
        # and https://stackoverflow.com/questions/42882243/how-do-you-pass-exception-argument-to-403-view for the need for kwargs
        re_path(r'^400/$', default_views.bad_request, kwargs={'exception': Exception('Bad Request!')}),
        re_path(r'^403/$', default_views.permission_denied, kwargs={'exception': Exception('Permission Denied')}),
        re_path(r'^404/$', default_views.page_not_found, kwargs={'exception': Exception('Page not Found')}),
        re_path(r'^500/$', default_views.server_error),
    ]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    #For Google Adsense, because of our serverless setup with GCP
    re_path(r'^ads.txt$',ads_txt,name='ads-txt'),

    # re_path(r'^culture/special/self-isolation/', IsolationView.as_view(), name='special-isolation'),
    # re_path(r'^(?P<section>culture)/(?P<slug>boredom-and-binging|in-full-bloom|temperature-checks|a-breath-of-fresh-air|paradise-found|under-water|healing-wounds|feeling-raw)/$', ArticleView.as_view()),
    # re_path(r'^magazine/(?P<year>[0-9]{4})/$', magazine.magazine, name='magazine-landing'),
    # re_path(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    re_path(r'^djadmin/', admin.site.urls),

    # re_path(r'^admin', include(admin_urls)),
    # re_path(r'^api/', include(api_urls)),
    # re_path(r'^podcasts/', include(podcasts_urls)),
    re_path(r'^newsletter/', include(newsletter_urls)),

    # Events
    # re_path(r'^events/', include(events_urls)),
    # re_path(r'^api/events/', include(event_api_urls)),

    # Tag
    re_path(r'^tag/(?P<slug>[-\w]+)/$', tag.tag, name='tag-page'),  
    re_path(r'^tag/(?P<slug>[-\w]+)/rss/$', TagFeed(), name='tag-page-feed'),    

    # Advertising
    re_path(r'^advertise/$', advertise.new, name='advertise-new'),

    # Wagtail
    re_path(r'^admin/', include(wagtailadmin_urls)),
    re_path(r'^documents/', include(wagtaildocs_urls)),
    re_path(r'^infinitefeed/$', infinitefeed, name='infinitefeed'), 
    re_path(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),
    re_path(r'^rss/(?P<slug>[-\w]+)/$', SectionFeed(), name='section-feed'),
    re_path(r'^authors/(?P<slug>[-\w]+)/rss/$', AuthorFeed(), name='author-feed'),
    re_path(r'^blog/', redirect_blog_to_humour),
    re_path(r'^sitemap.xml$', sitemap),
    path('', include(wagtail_urls)),

    # # standard Ubyssey site
    # re_path(r'^$', HomePageView.as_view(), name='home'),
    # re_path(r'^search/$', ArchiveView.as_view(), name='search'), #to preserve URL but get rid of tiny redirect view
    # re_path(r'^archive/$', ArchiveView.as_view(), name='archive'),
    # re_path(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),

    # # Page views that have been grandfathered in to having special URLs as permalink
    # re_path(r'^(?P<slug>about)/$', PageView.as_view(), name='about'),
    # re_path(r'^(?P<slug>volunteer)/$', PageView.as_view(), name='volunteer'),
    # re_path(r'^(?P<slug>advice)/$', PageView.as_view(), name='advice'),
    # re_path(r'^(?P<slug>submit-an-opinion)/$', PageView.as_view(), name='submit-an-opinion'),

    # # Other pages
    # re_path(r'^page/(?P<slug>[-\w]+)/$', PageView.as_view(), name='page'),

    # re_path(r'^(?P<slug>[-\w]+)/rss/$', SectionFeed(), name='section-feed'),
    # re_path(r'^authors/(?P<slug>[-\w]+)/$', AuthorView.as_view(), name='author'),

    # # Guide to UBC
    # re_path(r'^guide/2016/$', guide2016.landing, name='guide-landing-2016'),
    # re_path(r'^guide/2016/(?P<slug>[-\w]+)/$', guide2016.article, name='guide-article-2016'),

    # re_path(r'^guide/(?P<year>[0-9]{4})/$', GuideLandingView.as_view(), name='guide-landing'),
    # re_path(r'^guide/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/$', GuideLandingView.as_view(), name='guide-landing-sub'),
    # re_path(r'^guide/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/(?P<slug>[-\w]+)/$', GuideArticleView.as_view(), name='guide-article'),

    # # Magazine
    # re_path(r'^magazine/(?P<year>[0-9]{4})/$', magazine.magazine, name='magazine-landing'),
    # re_path(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    # # # Magazine new = on pause until wagtail happens a bit more
    # # re_path(r'^mag/(?P<year>[0-9]{4})/$', MagazineLandingView.as_view(), name='mag-landing'),
    # # re_path(r'^mag/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/$', MagazineLandingView.as_view(), name='mag-landing-sub'),
    # # re_path(r'^mag/(?P<year>[0-9]{4})/(?P<subsection>[-\w]+)/(?P<slug>[-\w]+)/$', MagazineArticleView.as_view(), name='mag-article'),

    # # Centennial
    # re_path(r'^100/$', UbysseyTheme.centennial, name='centennial-landing'), #was for special 2018 event. Consider removing.

    # # Beta-features
    # # re_path(r'^beta/notifications/$', theme.notification, name='notification-beta'),

    # # Podcasts
    # re_path(r'^podcast/(?P<slug>[-\w]+)', PodcastView.as_view(), name='podcasts'),

    # # Videos
    # re_path(r'^videos/', VideoView.as_view(), name='videos'),

    # # Subsections
    # re_path(r'^subsection/(?P<slug>[-\w]+)/$', SubsectionView.as_view(), name='subsection'), #Dislike this, 
    
    # re_path(r'^(?P<section>[-\w]+)/(?P<slug>[-\w]+)/$', ArticleView.as_view(), name='article'),
    # re_path(r'^(?P<slug>[-\w]+)/$', SectionView.as_view(), name='section'),
    # re_path(r'^api/articles/(?P<pk>[0-9]+)/rendered/$', ArticleAjaxView.as_view(), name='article-ajax'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
