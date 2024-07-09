from django.urls import path, include
from .views import EventsTheme, api

events = EventsTheme()

app_name = 'events'
urlpatterns = [
    path('', events.landing, name='events-page'),
    path('api/', include(api.urls))
]