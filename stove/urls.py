from django.urls import path

from . import views
from .api import api_router

app_name = "stove"

urlpatterns = [
    path("", views.index, name="index"),
    path("page/<int:page_id>", views.manuscript_editor, name="manuscript_editor"),
    path("page/<int:page_id>/preview", views.manuscript_preview, name="manuscript_preview"),
    path("page/<int:page_id>/full-preview", views.manuscript_full_preview, name="manuscript_full_preview"),
    path("page/<int:page_id>/restore", views.manuscript_restore, name="manuscript_restore"),
    path("page/<int:page_id>/media-upload", views.article_media_upload, name="article_media_upload"),
    path("author/<int:page_id>", views.author_editor, name="author_editor"),
    path("homepage/<int:page_id>", views.homepage_editor, name="homepage_editor"),
    path("section/<int:page_id>", views.section_editor, name="section_editor"),
    path("liveblog/<int:page_id>", views.liveblog_editor, name="liveblog_editor"),
    path("api/v2/", api_router.urls),
    # I'll add more later
]
