from django.urls import include, path
from rest_framework import routers

from .views import EventsTheme, EventsViewSet

events = EventsTheme()

app_name = "events"
urlpatterns = [
    path("", events.react, name="events-page"),
]
