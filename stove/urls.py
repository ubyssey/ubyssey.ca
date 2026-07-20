from django.urls import path
from django.urls import re_path

from . import views
from .api import api_router

app_name = "stove"

urlpatterns = [
    path("", views.content_tracker_react, name="content_tracker_base"),
    re_path(r"^oven/((?P<section>\w+)/)?$", views.content_tracker_react, name="content_tracker_react"),
    re_path(r"^oven/(?P<section>\w+)/(?P<page>\d+)$", views.load_pages, name="content_tracker_load_pages"),
    path("content/<int:page_id>/update", views.update_content_tracker, name="update_content_tracker"),
    path("page/<int:page_id>", views.manuscript_editor, name="manuscript_editor"),
    path("page/<int:page_id>/preview", views.manuscript_preview, name="manuscript_preview"),
    path("page/<int:page_id>/full-preview", views.manuscript_full_preview, name="manuscript_full_preview"),
    path("page/<int:page_id>/restore", views.manuscript_restore, name="manuscript_restore"),
    path("page/<int:page_id>/media-upload", views.article_media_upload, name="article_media_upload"),
    path("page/<int:page_id>/media-existing", views.article_media_add_existing, name="article_media_add_existing"),
    path("author/<int:page_id>", views.author_editor, name="author_editor"),
    path("homepage/<int:page_id>", views.homepage_editor, name="homepage_editor"),
    path("section/<int:page_id>", views.section_editor, name="section_editor"),
    path("liveblog/<int:page_id>", views.liveblog_editor, name="liveblog_editor"),
    path("api/v2/", api_router.urls),
]
