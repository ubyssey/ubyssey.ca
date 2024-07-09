from django.shortcuts import render

from events.models import Event
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import serializers, viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend

# Create your views here.
class EventsTheme(object):
    """Theme for the events microsite"""

    def landing(self, request):
        """Events page landing page"""
        if request.GET.get("show_hidden"):
            if request.GET.get("category"):
                events = Event.objects.filter(category=request.GET.get("category")).order_by("start_time")
            else:
                events = Event.objects.all().order_by("start_time")
        else:
            if request.GET.get("category"):
                events = Event.objects.filter(category=request.GET.get("category"),hidden=False).order_by("start_time")
            else:
                events = Event.objects.filter(hidden=False).order_by("start_time")

        calendar = []
        day = timezone.now() - timedelta(days=7 + timezone.now().weekday())
        day = day - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second)
        
        events_index = 0
        week = {'month': day.strftime("%B"), 'month_short': day.strftime("%b"), 'days': [{'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []}]}

        closest_event = None

        ongoing = []

        while(len(calendar) < 4):

            if day.date() == timezone.now().date():
                week['days'][-1]['phase'] = 'today'
            elif day < timezone.now() - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second):
                week['days'][-1]["phase"] = 'past'
            else:
                week['days'][-1]['phase'] = 'future'

            if day.day == 1:
                week['month'] = day.strftime("%B")
                week['month_short'] = day.strftime("%b")

            if events_index >= len(events):
                day = day + timedelta(days=1)
                if day.weekday()==0:
                    calendar.append(week)
                    week = {'month': day.strftime("%B"), 'month_short': day.strftime("%b"), 'days': [{'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []}]}
                else:
                    week['days'].append({'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []})
                    i=0
                    while i<len(ongoing):
                        week['days'][-1]['events'].append(ongoing[i])
                        if ongoing[i].end_time.astimezone(timezone.get_current_timezone()).date() == day.date():
                            ongoing.pop(i)
                        else:
                            i = i + 1
            else:
                events[events_index].start_time = events[events_index].start_time.astimezone(timezone.get_current_timezone())
                events[events_index].end_time = events[events_index].end_time.astimezone(timezone.get_current_timezone())
                
                if closest_event == None and timezone.now() <= events[events_index].start_time:
                    closest_event = events[events_index]
                if day > events[events_index].start_time:
                    events_index = events_index + 1
                else:
                    if day.date() == events[events_index].start_time.date():
                        week['days'][-1]['events'].append(events[events_index])
                        if not events[events_index].end_time.date() < (day+timedelta(days=1)).date():
                            ongoing.append(events[events_index])
                        events_index = events_index + 1
                    else:
                        day = day + timedelta(days=1)
                        if day.weekday()==0:
                            calendar.append(week)
                            week = {'month': day.strftime("%B"), 'month_short': day.strftime("%b"), 'days': [{'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []}]}
                        else:
                            week['days'].append({'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []})

                        i=0
                        while i<len(ongoing):
                            if ongoing[i].end_time.date() < day.date():
                                ongoing.pop(i)
                            else:
                                week['days'][-1]['events'].append(ongoing[i])
                                i = i + 1
        
        event = closest_event
        
        if request.GET.get("event"):
            print(request.GET.get("event"))
            if Event.objects.filter(event_url=request.GET.get("event")).exists():
                event = Event.objects.get(event_url=request.GET.get("event"))
                event.selected = True

        if event:
            event.description = event.description.replace('\n', '<br>')

        return render(request, "events/event_page.html", {'calendar':calendar,'selectedEvent': event})

def update_events(request):
    from urllib.request import urlopen, Request
    from icalendar import Calendar
    from django.http import HttpResponse
    #try:
    req = Request("https://events.ubc.ca/events/?ical=1", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
    con = urlopen(req)

    cal = Calendar.from_ical(con.read())
    for component in cal.walk():
        if component.name == "VEVENT":
            Event.objects.ubcevents_create_event(component)
            
    #except:
    #    return HttpResponse("Failed requesting to UBCevents", status=500)

    #try:
    req = Request("https://gothunderbirds.ca/calendar.ashx/calendar.ics", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
    con = urlopen(req)

    cal = Calendar.from_ical(con.read())
    for component in cal.walk():
        if component.name == "VEVENT":
            Event.objects.gothunderbirds_create_event(component)
            
    #except:
    #    return HttpResponse("Failed requesting to UBCevents", status=500)

    return HttpResponse("Success!")

class EventsSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Event
        fields = ['title', 'description', 'start_time', 'end_time', 'location', 'address', 'host', 'email', 'event_url', 'category']

class EventsViewSet(viewsets.ModelViewSet):
    serializer_class = EventsSerializer
    queryset = Event.objects.filter(hidden=False, end_time__gte=timezone.now()).order_by("start_time")
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ['category', 'location', 'host']
    search_fields = ['title', 'description', 'host', 'location', '^event_url']
