from django.shortcuts import render

from events.models import Event
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import serializers, viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
import math

# Create your views here.
class EventsTheme(object):
    """Theme for the events microsite"""

    def landing(self, request):
        """Events page landing page"""

        calendar = []
        day = timezone.now() - timedelta(days=7 + timezone.now().weekday())
        day = day - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second)
        
        events_index = 0
        week = {'month': day.strftime("%B"), 'month_short': day.strftime("%b"), 'days': [{'day': day.day, 'day_of_week': day.strftime("%a"), 'events': []}]}
        
        if request.GET.get("show_hidden"):
            if request.GET.get("category"):
                events = Event.objects.filter(category=request.GET.get("category"), end_time__gte=day).order_by("start_time")
            else:
                events = Event.objects.filter(end_time__gte=day).order_by("start_time")
        else:
            if request.GET.get("category"):
                events = Event.objects.filter(category=request.GET.get("category"), end_time__gte=day,hidden=False).order_by("start_time")
            else:
                events = Event.objects.filter(hidden=False, end_time__gte=day).order_by("start_time")
        
        weekNum = 4
        if request.GET.get("weeks"):
            weekNum = int(request.GET.get("weeks")) 

        closest_event = None

        ongoing = []

        tab = "all"
        highlight = "category"
        if request.GET.get("category"):
            highlight = "host"
            tab = request.GET.get("category")

        legend = []

        while(len(calendar) < weekNum):

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


                        highlighted_feature = getattr(events[events_index], highlight)

                        if not highlighted_feature in legend and highlighted_feature != None:
                            legend.append(highlighted_feature)

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
        
        if highlight == "category":
            category_order = ["sports", "entertainment", "community", "seminar"]
            e = lambda a : category_order.index(a)
            legend.sort(key=e)

        highlight_colours = {}
        for i in range(len(legend)):
            r = 200 + math.floor(50 * math.cos(i/len(legend) * 2 * math.pi))
            g = 200 + math.floor(50 * math.sin(i/len(legend) * 2 * math.pi))
            b = 200
            highlight_colours[legend[i]] = "rgb(" + ",".join([str(r), str(g), str(b)]) + ")"

        event = closest_event
        
        if request.GET.get("event"):
            print(request.GET.get("event"))
            if Event.objects.filter(event_url=request.GET.get("event")).exists():
                event = Event.objects.get(event_url=request.GET.get("event"))
                event.selected = True

        if event:
            event.description = event.description.replace('\n', '<br>')

            event.start_time = event.start_time.astimezone(timezone.get_current_timezone())
            event.end_time = event.end_time.astimezone(timezone.get_current_timezone())

            if event.start_time.month == event.end_time.month and event.start_time.day == event.end_time.day:
                if event.start_time.time() == event.end_time.time():
                    event.displayTime = event.start_time.strftime("%B %-d")
                else:
                    event.displayTime = event.start_time.strftime("%B %-d, %-I:%M%p") + " - " + event.end_time.strftime("%-I:%M%p")
            else:
                if event.start_time.time() == event.end_time.time():
                    event.displayTime = event.start_time.strftime("%B %-d") + " - "  + event.end_time.strftime("%B %-d")
                else:
                    event.displayTime = event.start_time.strftime("%B %-d %-I:%M%p") + " - " + event.end_time.strftime("%B %-d %-I:%M%p")

        return render(request, "events/event_page.html", {'calendar':calendar,'selectedEvent': event, 'highlight': highlight, 'legend': legend, 'highlight_colours': highlight_colours, 'tab': tab})

def update_events(request):
    from urllib.request import urlopen, Request
    from icalendar import Calendar
    from django.http import HttpResponse
    from datetime import datetime
    import requests
    from bs4 import BeautifulSoup

    for event in Event.objects.filter(update_mode=1, end_time__gte=timezone.now()):
        event.update_mode = 2
        event.save()
    
    try:
        response = requests.get('https://phas.ubc.ca/events')
        html_content = response.text

        # Parse the HTML content
        soup = BeautifulSoup(html_content, 'html.parser')
        events = soup.find_all(class_='views-row')

        current_tz = timezone.get_current_timezone()
        current_time = datetime.now(current_tz)
        
        for event in events:
            start_time_str = event.find('span', class_='start').get_text(strip=True)
            parsed_start_time = datetime.fromisoformat(start_time_str)
            start_time = datetime.combine(parsed_start_time.date(), parsed_start_time.time(), tzinfo=current_tz)

            if start_time >= current_time:
                Event.objects.process_and_store_event(event)
            else:
                break
    except:
        return HttpResponse("Failed requesting to Physics and Astronomy Events page", status=500)

    try:
        req = Request("https://events.ubc.ca/events/?ical=1", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
        con = urlopen(req)

        cal = Calendar.from_ical(con.read())
        for component in cal.walk():
            if component.name == "VEVENT":
                Event.objects.ubcevents_create_event(component)
            
    except:
        return HttpResponse("Failed requesting to UBCevents", status=500)

    try:
        req = Request("https://gothunderbirds.ca/calendar.ashx/calendar.ics", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
        con = urlopen(req)

        cal = Calendar.from_ical(con.read())
        for component in cal.walk():
            if component.name == "VEVENT":
                Event.objects.gothunderbirds_create_event(component)
                
    except:
        return HttpResponse("Failed requesting to UBCevents", status=500)

    for event in Event.objects.filter(update_mode=2):
        event.delete()

    return HttpResponse("Success!", status=200)

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
