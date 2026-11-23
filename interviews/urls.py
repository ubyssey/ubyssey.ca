from django.urls import path

from . import views

app_name = "interviews"

urlpatterns = [
    path("", views.library, name="library"),
]
