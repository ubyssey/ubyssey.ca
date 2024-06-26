from django.shortcuts import render

from events.models import Event

# Create your views here.
class EventsTheme(object):
    """Theme for the events microsite"""

    def landing(self, request):
        """Events page landing page"""
        events = Event.objects.all()
        return render(request, "events/event_page.html", {})