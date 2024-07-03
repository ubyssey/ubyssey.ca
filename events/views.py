from django.shortcuts import render

from events.models import Event
from datetime import datetime, timedelta
from django.utils import timezone

# Create your views here.
class EventsTheme(object):
    """Theme for the events microsite"""

    def landing(self, request):
        """Events page landing page"""
        if request.GET.get("category"):
            events = Event.objects.filter(category=request.GET.get("category"),hidden=False).order_by("start_time")
        else:
            events = Event.objects.filter(hidden=False).order_by("start_time")

        calendar = []
        day = timezone.now() - timedelta(days=7 + timezone.now().weekday())
        day = day - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second)
        
        events_index = 0
        week = {'month': day.strftime("%b"), 'days': [{'day': day.day, 'events': []}]}

        closest_event = None

        ongoing = []

        while(len(calendar) < 4):

            if day.day == 1:
                week["month"] = day.strftime("%b")

            if day.date() == timezone.now().date():
                week['days'][-1]['phase'] = 'today'
            elif day < timezone.now() - timedelta(hours=day.hour, minutes=day.minute, seconds=day.second):
                week['days'][-1]["phase"] = 'past'
            else:
                week['days'][-1]['phase'] = 'future'

            if events_index >= len(events):
                day = day + timedelta(days=1)
                if day.weekday()==0:
                    calendar.append(week)
                    week = {'month': None, 'days': [{'day': day.day, 'events': []}]}
                else:
                    week['days'].append({'day': day.day, 'events': []})
                    i=0
                    while i<len(ongoing):
                        week['days'][-1]['events'].append(ongoing[i])
                        if ongoing[i].end_time.astimezone(timezone.get_current_timezone()).date() == day.date():
                            ongoing.pop(i)
                        else:
                            i = i + 1
            else:
                event_time = events[events_index].start_time.astimezone(timezone.get_current_timezone())
                
                if closest_event == None and timezone.now() <= event_time:
                    closest_event = events[events_index]
                if day > event_time:
                    events_index = events_index + 1
                else:
                    if day.date() == event_time.date():
                        week['days'][-1]['events'].append(events[events_index])
                        if events[events_index].end_time.astimezone(timezone.get_current_timezone()).date() != day.date():
                            ongoing.append(events[events_index])
                        events_index = events_index + 1
                    else:
                        day = day + timedelta(days=1)
                        if day.weekday()==0:
                            calendar.append(week)
                            week = {'month': None, 'days': [{'day': day.day, 'events': []}]}
                        else:
                            week['days'].append({'day': day.day, 'events': []})
                            i=0
                            while i<len(ongoing):
                                week['days'][-1]['events'].append(ongoing[i])
                                if ongoing[i].end_time.astimezone(timezone.get_current_timezone()).date() == day.date():
                                    ongoing.pop(i)
                                else:
                                    i = i + 1
        
        event = closest_event
        
        if request.GET.get("event"):
            if Event.objects.filter(event_url=request.GET.get("event")).exists():
                event = Event.objects.get(event_url=request.GET.get("event"))

        if event:
            event.description = event.description.replace('\n', '<br>')

        return render(request, "events/event_page.html", {'calendar':calendar,'event': event})

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