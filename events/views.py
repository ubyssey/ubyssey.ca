from django.shortcuts import render

from events.models import Event
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import serializers, viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
import math
from django.contrib.syndication.views import Feed
from ubyssey.views.feed import RssFeedWithImage
from typing import Any, Dict

def format_event_date(start, end, weekDay=False):
    start = start.astimezone(timezone.get_current_timezone())
    end = end.astimezone(timezone.get_current_timezone())

    displayTime = ""

    if start.date() == end.date():
        if weekDay:
            displayTime = displayTime + start.strftime("%a. ")
        if start.time() == end.time():
            displayTime = displayTime + start.strftime("%B %-d")
        else:
            displayTime = displayTime + start.strftime("%B %-d, %-I")
            if start.strftime("%M") != "00":
                displayTime = displayTime + start.strftime(":%M")
            displayTime = displayTime + start.strftime("%p") + " - "
            
            displayTime = displayTime + end.strftime("%-I")
            if end.strftime("%M") != "00":
                displayTime = displayTime + end.strftime(":%M")
            displayTime = displayTime + end.strftime("%p")
    else:
        if start.time() == end.time():
            if weekDay:
                displayTime = displayTime + start.strftime("%a. %B %-d") + " - "  + end.strftime("%a. %B %-d")
            else:
                displayTime = displayTime + start.strftime("%B %-d") + " - "  + end.strftime("%B %-d")
        else:
            if weekDay:
                displayTime = displayTime + start.strftime("%a. ")
        
            displayTime = displayTime + start.strftime("%B %-d, %-I")
            if start.strftime("%M") != "00":
                displayTime = displayTime + start.strftime(":%M")
            displayTime = displayTime + start.strftime("%p") + " - "

            if weekDay:
                displayTime = displayTime + start.strftime("%a. ")

            displayTime = displayTime + end.strftime("%B %-d, %-I")
            if end.strftime("%M") != "00":
                displayTime = displayTime + end.strftime(":%M")
            displayTime = displayTime + end.strftime("%p")

    return displayTime

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

            ical = {'url': 'https://ubyssey.ca/events/ical/?category=' + request.GET.get("category"),
                    'title': "Ubyssey's " + request.GET.get("category").capitalize()  + " Around Campus iCal Feed"}

            rss = {'url': 'https://ubyssey.ca/events/rss/?category=' + request.GET.get("category"),
                   'title': "Ubyssey's " + request.GET.get("category").capitalize()  + " Around Campus rss Feed"}

        else:
            ical = {'url': 'https://ubyssey.ca/events/ical/',
                    'title': "Ubyssey's Events Around Campus iCal Feed"}

            rss = {'url': 'https://ubyssey.ca/events/rss/',
                   'title': "Ubyssey's Events Around Campus rss Feed"}
        
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
            b = 200 + math.floor(50 * math.cos(i/len(legend) * 2 * math.pi + math.pi))
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

            event.displayTime = format_event_date(event.start_time, event.end_time)

        return render(request, "events/event_page.html", {'calendar':calendar,'selectedEvent': event, 'highlight': highlight, 'legend': legend, 'highlight_colours': highlight_colours, 'tab': tab, 'ical': ical, 'rss': rss})

def update_events(request):
    from urllib.request import urlopen, Request
    from icalendar import Calendar
    from django.http import HttpResponse
    from datetime import datetime

    for event in Event.objects.filter(update_mode=1, end_time__gte=timezone.now()):
        event.update_mode = 2
        event.save()

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
    
    try:
        req = Request("https://www.cs.ubc.ca/views/ical/related_events/calendar.ics", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
        con = urlopen(req)

        cal = Calendar.from_ical(con.read())
        for component in cal.walk():
            if component.name == "VEVENT":
                Event.objects.cs_ubc_create_event(component)
                
    except:
        return HttpResponse("Failed requesting to UBC CS", status=500)
    
    try:
        req = Request("https://www.stat.ubc.ca/events-calendar-feed/", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
        con = urlopen(req)

        cal = Calendar.from_ical(con.read())
        for component in cal.walk():
            if component.name == "VEVENT":
                Event.objects.stats_ubc_create_event(component)
 
    except:
        return HttpResponse("Failed requesting to UBC Stats", status=500)

    for event in Event.objects.filter(update_mode=2):
        event.delete()

    return HttpResponse("Success!", status=200)

def create_ical(request):
    from django.http import HttpResponse
    import icalendar

    cal = icalendar.Calendar()
    if request.GET.get('category'):
        cal['X-WR-CALNAME'] = request.GET.get('category').capitalize() + ' Around Campus from The Ubyssey'
        cal['X-ORIGINAL-URL'] = 'https://ubyssey.ca/events/?category=' + request.GET.get('category')
        cal['X-WR-CALDESC'] = request.GET.get('category').capitalize() + ' at UBC collected by The Ubyssey'
        all_events = Event.objects.filter(hidden=False, category=request.GET.get("category"))
    else:
        cal['X-WR-CALNAME'] = 'Events Around Campus from The Ubyssey'
        cal['X-ORIGINAL-URL'] = 'https://ubyssey.ca/events'
        cal['X-WR-CALDESC'] = 'Events at UBC collected by The Ubyssey'
        all_events = Event.objects.filter(hidden=False)

    for event in all_events:
        ical_event = icalendar.Event()
        ical_event.add('summary', event.title.replace("<br>", ""))
        ical_event.add('description', event.description)
        ical_event.add('location', event.location + ", " + event.address)
        ical_event.add('dtstart', event.start_time.astimezone(timezone.get_current_timezone()))
        ical_event.add('dtend', event.end_time.astimezone(timezone.get_current_timezone()))
        if request.GET.get('category'):
            ical_event.add('url', "https://ubyssey.ca/events/?category=" + request.GET.get('category') + "&event=" + event.event_url)
        else:
            ical_event.add('url', "https://ubyssey.ca/events/?event=" + event.event_url)
        ical_event.add('categories', event.category)
        ical_event.add('uid', event.event_url)
        if event.host:
            if 'gothunderbirds.ca' in event.event_url:
                ical_event.add('organizer', 'UBC ' + event.host)                
            else:
                ical_event.add('organizer', event.host)

        cal.add_component(ical_event)

    return HttpResponse(cal.to_ical(), 
            headers={
                "Content-Type": "text/calendar; charset=UTF-8",
                "Content-Disposition": 'attachment; filename="ubysseyCalendar.ics"',
            })

class EventsFeed(Feed):
    feed_type = RssFeedWithImage

    def __init__(self, max_items=100):
        self.max_items = max_items

    def feed_extra_kwargs(self, obj):
        '''
        Adding details for the feed logo
        '''
        return {
            "image_url": 'https://www.ubyssey.ca/static/ubyssey/images/ubyssey-logo-square.7fdeb5ac7f29.png',
            "image_title": 'Ubyssey Logo',
            "image_link": 'https://ubyssey.ca'}

    def get_object(self, request, *args, **kwargs):
        if request.GET.get('category'):
            return request.GET.get('category')
        else:
            False

    def title(self, category):
        if category:
            return category.capitalize() + ' Around Campus from The Ubyssey'
        else:
            return 'Events Around Campus from The Ubyssey'


    def link(self, category):
        if category:
            return 'https://ubyssey.ca/events/?category=' + category
        else:
            return 'https://ubyssey.ca/events/'

    def description(self, category):
        if category:
            return category.capitalize() + " around UBC campus collected by your friends at The Ubyssey"
        else:
            return "Events around UBC campus collected by your friends at The Ubyssey"

    def feed_url(self, category):
        if category:
            return 'https://ubyssey.ca/events/rss/?category=' + category
        else:
            return 'https://ubyssey.ca/events/rss/'

    def items(self, category):
        if category:
            return Event.objects.filter(hidden=False, category=category, end_time__gte=timezone.now(), start_time__lte=timezone.now() + timedelta(days=21))
        else:
            return Event.objects.filter(hidden=False, end_time__gte=timezone.now(), start_time__lte=timezone.now() + timedelta(days=21))

    def item_title(self, item):
        item.start_time = item.start_time.astimezone(timezone.get_current_timezone())
        return item.start_time.strftime("%-m/%-d %-I:%M%P") + " " + item.title.replace("<br>", "")

    def item_pubdate(self, item):
        return item.start_time.astimezone(timezone.get_current_timezone())

    description_template = "events/rss.html"

    def get_context_data(self, item=None, **kwargs: Any) -> Dict[str, Any]:
        context = super().get_context_data(**kwargs)

        if "https" in item.event_url:
            item.link = item.event_url
        else:
            item.link = "https://ubyssey.ca/events/?event=" + item.event_url
        
        item.displayTime = format_event_date(item.start_time, item.end_time, weekDay=True)

        context["item"] = item

        return context

    def item_author_name(self, item):
        return item.host

    def item_link(self, item):
        return "https://ubyssey.ca/events/?event=" + item.event_url

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
