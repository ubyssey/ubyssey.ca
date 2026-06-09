from django.urls import path

from . import views
from .api import api_router

app_name = "new_cms"

urlpatterns = [
    path("", views.index, name="index"),
    path("page/<int:page_id>", views.manuscript_editor, name="manuscript_editor"),
    path("page/<int:page_id>/preview", views.manuscript_preview, name="manuscript_preview"),
    path("page/<int:page_id>/media-upload", views.article_media_upload, name="article_media_upload"),
    path("homepage", views.homepage_editor, name="homepage_editor"),
    path("api/v2/", api_router.urls),
    # I'll add more later
]
