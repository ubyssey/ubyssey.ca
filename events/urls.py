from django.urls import path, include
from .views import EventsTheme, EventsViewSet
from rest_framework import routers

events = EventsTheme()

app_name = 'events'
urlpatterns = [
    path('', events.react, name='events-page'),
]