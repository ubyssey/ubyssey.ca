from django.shortcuts import render

from events.models import Event
from datetime import datetime, timedelta
from django.utils import timezone

# Create your views here.
class EventsTheme(object):
    """Theme for the events microsite"""

    def landing(self, request):
        """Events page landing page"""
        events = Event.objects.all().order_by("start_time")

        calendar = []
        day = timezone.now() - timedelta(days=7 + timezone.now().weekday())
        day = day - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second)
        
        events_index = 0
        week = [[]]

        closest_event = None

        while(len(calendar) < 4):

            if events_index >= len(events):
                day = day + timedelta(days=1)
                if day.weekday()==0:
                    calendar.append(week)
                    week = [[]]
                else:
                    week.append([])
            else:
                event_time = events[events_index].start_time.astimezone(timezone.get_current_timezone())
                
                if closest_event == None and timezone.now() <= event_time:
                    closest_event = events[events_index]
                if day > event_time:
                    events_index = events_index + 1
                else:
                    if day.date() == event_time.date():
                        week[-1].append(events[events_index])
                        events_index = events_index + 1
                    else:
                        day = day + timedelta(days=1)
                        if day.weekday()==0:
                            calendar.append(week)
                            week = [[]]
                        else:

                            week.append([])
        
        event = closest_event
        
        if request.GET.get("id"):
            if Event.objects.filter(id=request.GET.get("id")).exists():
                event = Event.objects.get(id=request.GET.get("id"))

        event.description = event.description.replace('\n', '<br>')

        return render(request, "events/event_page.html", {'calendar':calendar,'event': event})