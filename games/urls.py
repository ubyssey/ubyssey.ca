from django.urls import path
from django.urls import re_path

from . import views

app_name = "games"

urlpatterns = [
    path("", views.home, name="home"),
    # Change to something like this in the future /gametype/year/month/day/
    path("crosswords/<int:id>", views.crosswords, name="crosswords"),
]
