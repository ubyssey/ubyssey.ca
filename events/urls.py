from django.urls import path, include
from .views import EventsTheme, EventsViewSet
from rest_framework import routers

events = EventsTheme()

api = routers.DefaultRouter()
api.register(r'events', EventsViewSet)

app_name = 'events'
urlpatterns = [
    path('', events.landing, name='events-page'),
]