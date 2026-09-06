from django.conf import settings
from django.urls import include, path, re_path
from django.conf.urls.static import static
from django.contrib import admin
from django.views import defaults as default_views
from django.views.generic.base import TemplateView
from django.shortcuts import redirect

from wagtail.admin import urls as wagtailadmin_urls
from wagtail import urls as wagtail_urls
from wagtail.documents import urls as wagtaildocs_urls
from wagtail.contrib.sitemaps.views import sitemap

from stove.api import api_router as cms_api_router

from ubyssey.views.main import ads_txt, redirect_blog_to_humour, publish_scheduled_http
from ubyssey.views.auxiliary import our_team, podcast, video

from ubyssey.views.feed import FrontpageFeed, SectionFeed, AuthorFeed, TagFeed
from ubyssey.views.advertise import AdvertiseTheme
from ubyssey.views.tip import TipForm
from ubyssey.views.tag import TagPage, redirect_tag_feed_to_topic, redirect_tag_to_topic
from events.views import update_events_http, create_ical, EventsFeed, EventsViewSet
from events.urls import urlpatterns as events_urls
from navigation.views import nav_search
from home.views import homepage_curated_api, publish_committee_workflow_api, articlepage_drafts_api, articlepage_drafts_api_list

from infinitefeed.views import infinitefeed

from newsletter.urls import urlpatterns as newsletter_urls
from django.conf.urls import handler500
from pathlib import Path

from publishing_analytics import views as publishing_analytics_views 
from content_tracker.views import story_assignment_api_list, visual_assignment_api_list

from rest_framework import routers

handler500 = 'ubyssey.views.main.custom_500'

tip = TipForm()
advertise = AdvertiseTheme()
tag = TagPage()

urlpatterns = []

api = routers.DefaultRouter()
api.register(r'events', EventsViewSet)

if settings.DEBUG:
    import debug_toolbar
    from article.views import redesign_preview
    from liveblog.views import redesign_preview as liveblog_redesign_preview
    from section.views import redesign_preview as section_redesign_preview
    from authors.views import redesign_preview as author_redesign_preview
    from ubyssey.views.auxiliary_preview import auxiliary_preview
    urlpatterns += [
        path("redesign-preview/article/live-updates/<slug:state>/", liveblog_redesign_preview, name="liveblog-redesign-preview"),
        path("redesign-preview/article/<slug:layout>/", redesign_preview, name="article-redesign-preview"),
        path("redesign-preview/section/", section_redesign_preview, name="section-redesign-preview"),
        path("redesign-preview/author/", author_redesign_preview, name="author-redesign-preview"),
        path("video/", auxiliary_preview, {"page_key": "video"}, name="video-redesign-preview"),
        path("photo/", auxiliary_preview, {"page_key": "photo"}, name="photo-redesign-preview"),
        path("the-vilest-rag/", auxiliary_preview, {"page_key": "podcast"}, name="podcast-redesign-preview"),
        path("margins/", auxiliary_preview, {"page_key": "margins"}, name="margins-redesign-preview"),
        path("archive/", auxiliary_preview, {"page_key": "archive"}, name="archive-redesign-preview"),
        path("about/our-journalism/", auxiliary_preview, {"page_key": "our-journalism"}, name="journalism-redesign-preview"),
        path("about/our-team/", auxiliary_preview, {"page_key": "our-team"}, name="team-redesign-preview"),
        path("contact/masthead/", auxiliary_preview, {"page_key": "masthead"}, name="masthead-redesign-preview"),
        path("about/ups-board/", auxiliary_preview, {"page_key": "ups-board"}, name="board-redesign-preview"),
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
    # Local-only media captured from the production-shaped redesign fixture.
    # This keeps visual QA deterministic without changing production storage.
    redesign_sample_root = Path(settings.BASE_DIR).parent / "redesign" / "redesign_sample_content"
    if redesign_sample_root.exists():
        urlpatterns += static("/redesign-sample/", document_root=redesign_sample_root)

urlpatterns += [
    # Redesigned support pages are production routes. The fixture previews
    # above remain DEBUG-only, but these contexts are backed by live CMS data.
    path("about/our-team/", our_team, name="team-redesign"),
    path("the-vilest-rag/", podcast, name="podcast-redesign"),
    path("video/", video, name="video-redesign"),
    #For Google Adsense, because of our serverless setup with GCP
    re_path(r'^ads.txt$',ads_txt,name='ads-txt'),

    # For politely telling annoying guys to leave us alone
    path(
        "robots.txt",
        TemplateView.as_view(template_name="robots.txt", content_type="text/plain"),
    ),

    # Special design articles
    re_path(r'^features/how-substance-use-impacts-queer-students', TemplateView.as_view(template_name='article/queer-substance-abuse.html')),
    re_path(r'^features/window-watching', TemplateView.as_view(template_name='article/nocturne-window-watching.html')),
    # re_path(r'^culture/special/self-isolation/', IsolationView.as_view(), name='special-isolation'),
    # re_path(r'^(?P<section>culture)/(?P<slug>boredom-and-binging|in-full-bloom|temperature-checks|a-breath-of-fresh-air|paradise-found|under-water|healing-wounds|feeling-raw)/$', ArticleView.as_view()),
    # re_path(r'^magazine/(?P<year>[0-9]{4})/$', magazine.magazine, name='magazine-landing'),
    # re_path(r'^magazine/(?P<slug>[-\w]+)/$', magazine.article, name='magazine-article'),

    re_path(r'^humour/girlslowermainland/$', TemplateView.as_view(template_name='spoof/2025/landing.html')),
    re_path(r'^humour/girlslowermainland/useless-crafts/$', TemplateView.as_view(template_name='spoof/2025/useless-crafts.html')),
    re_path(r'^humour/girlslowermainland/get-it-together/$', TemplateView.as_view(template_name='spoof/2025/get-it-together.html')),
    re_path(r'^humour/girlslowermainland/people-and-cairns/$', TemplateView.as_view(template_name='spoof/2025/people-and-cairns.html')),
    re_path(r'^humour/girlslowermainland/from-alleged-readers/$', TemplateView.as_view(template_name='spoof/2025/from-alleged-readers.html')),
    re_path(r'^humour/girlslowermainland/activities-and-whatnot/$', TemplateView.as_view(template_name='spoof/2025/activities-and-whatnot.html')),

    re_path(r'^djadmin/', admin.site.urls),

    path('cms-api/v2/', cms_api_router.urls),

    # re_path(r'^admin', include(admin_urls)),
    # re_path(r'^api/', include(api_urls)),
    # re_path(r'^podcasts/', include(podcasts_urls)),
    re_path(r'^newsletter/', include(newsletter_urls)),

    re_path(r'^search/', nav_search),
    re_path(r'^admin/homepage_curated_api/', homepage_curated_api),
    re_path(r'^admin/publish_committee_workflow_api/', publish_committee_workflow_api),
    path('admin/articlepage_drafts_api/<int:id>/', articlepage_drafts_api),
    path('admin/articlepage_drafts_api/', articlepage_drafts_api_list),

    path('admin/story_assignment_api/', story_assignment_api_list),
    path('admin/visual_assignment_api/', visual_assignment_api_list),

    path('stove/', include('stove.urls')),

    # Events
    re_path(r'^events/', include(events_urls)),
    re_path(r'^events/ical/$', create_ical, name="events_ical"),
    re_path(r'^events/rss/$', EventsFeed(), name='events-feed'),  
    re_path(r'^api/', include(api.urls)),

    # Tag
    re_path(r'^tag/(?P<slug>[-\w]+)/$', redirect_tag_to_topic),
    re_path(r'^tag/(?P<slug>[-\w]+)/rss/$', redirect_tag_feed_to_topic),  
    re_path(r'^topic/(?P<slug>[-\w]+)/$', tag.tag, name='tag-page'),  
    re_path(r'^topic/(?P<slug>[-\w]+)/rss/$', TagFeed(), name='tag-page-feed'),

    # Publish analytics
    #re_path(r'^overview/$', publishing_analytics_views.overview), Removed because gathering the data takes too long
    re_path(r'^overview/(?P<year>[0-9]{4})/$', publishing_analytics_views.year_overview),
    re_path(r'^overview/(?P<year>[0-9]{4})/(?P<month>[0-9]{2})/$', publishing_analytics_views.month_overview),
    re_path(r'^overview/(?P<section>[-\w]+)/$', publishing_analytics_views.section_overview),
    re_path(r'^overview/(?P<section>[-\w]+)/(?P<year0>[0-9]{4})-(?P<year1>[0-9]{4})/$', publishing_analytics_views.section_year_overview),

    # Advertising
    re_path(r'^advertise/$', advertise.new, name='advertise-new'),

    # Tip form
    re_path(r'^email/tip/$', tip.email_tip, name='email-tip'),

    # Cron job
    re_path(r'^cron/update-events/$', update_events_http, name='update_events'),
    re_path(r'^cron/publish-scheduled/$', publish_scheduled_http, name='publish_scheduled'),

    # Wagtail
    re_path(r'^admin/', include(wagtailadmin_urls)),
    re_path(r'^documents/', include(wagtaildocs_urls)),
    re_path(r'^infinitefeed/$', infinitefeed, name='infinitefeed'), 
    re_path(r'^rss/$', FrontpageFeed(), name='frontpage-feed'),
    re_path(r'^authors/(?P<slug>[-\w]+)/rss/$', AuthorFeed(), name='author-feed'),
    re_path(r'^blog/', redirect_blog_to_humour),
    re_path(r'^sitemap.xml$', sitemap),
    # re_path(r'^health/', include('health_check.urls')),  # Removed - not needed
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
