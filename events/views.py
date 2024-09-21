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

    def react(self, request):
        ical = {'url': 'https://ubyssey.ca/events/ical/',
                'title': "Ubyssey's Events Around Campus iCal Feed"}

        rss = {'url': 'https://ubyssey.ca/events/rss/',
                'title': "Ubyssey's Events Around Campus rss Feed"}
    
        meta = {
            'title': "Events Around Campus Calendar",
            'description': "Events Around Campus collected by The Ubyssey",
            'url': 'https://ubyssey.ca/events/',
            }

        if request.GET.get("event"):
            if Event.objects.filter(hash=request.GET.get("event")).exists():
                event = Event.objects.filter(hash=request.GET.get("event")).first()

                meta = {
                    'title': event.title,
                    'description': event.description,
                    'url': "https://ubyssey.ca/events/?event=" + event.hash,
                    'noindex': True,
                }

        return render(request, "events/event_page_react.html", {'ical':ical, 'rss':rss, 'meta':meta})

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

            meta = {
                'title': request.GET.get("category").capitalize()  + " Around Campus Calendar",
                'description': request.GET.get("category").capitalize()  + " Around Campus collected by The Ubyssey",
                'url': 'https://ubyssey.ca/events/?category=' + request.GET.get("category"),
                }

        else:
            ical = {'url': 'https://ubyssey.ca/events/ical/',
                    'title': "Ubyssey's Events Around Campus iCal Feed"}

            rss = {'url': 'https://ubyssey.ca/events/rss/',
                   'title': "Ubyssey's Events Around Campus rss Feed"}
        
            meta = {
                'title': "Events Around Campus Calendar",
                'description': "Events Around Campus collected by The Ubyssey",
                'url': 'https://ubyssey.ca/events/',
                }

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

                if request.GET.get("category")=='seminar' or events[events_index].category!='seminar':
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
        else:
            legend.sort()

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
                event = Event.objects.filter(event_url=request.GET.get("event")).first()
                event.selected = True

                meta = {
                'title': event.title,
                'description': event.description,
                'url': "https://ubyssey.ca/events/?event=" + event.event_url,
                'noindex': True,
                }

        if event:
            event.description = event.description.replace('\n', '<br>')

            event.start_time = event.start_time.astimezone(timezone.get_current_timezone())
            event.end_time = event.end_time.astimezone(timezone.get_current_timezone())

            event.displayTime = format_event_date(event.start_time, event.end_time)

        return render(request, "events/event_page.html", {'calendar':calendar,'selectedEvent': event, 'highlight': highlight, 'legend': legend, 'highlight_colours': highlight_colours, 'tab': tab, 'ical': ical, 'rss': rss, 'meta': meta})

async def update_events(request):
    from django.http import HttpResponse
    import asyncio

    async for event in Event.objects.filter(update_mode=1, end_time__gte=timezone.now()):
        event.update_mode = 2
        await event.asave()
    
    tasks = []
    max_at_a_time = 50
    tasks.append(asyncio.create_task(Event.objects.phas_scrape()))

    wp_apis = [

        {'name': 'UBC Anthropology', 
         'api': 'https://anth.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [633, 632, 634, 528, 530],
            'hidden_title_terms': ['coffee hour'],
            'seminar_title_terms': ['Archaeology Lab Nights'],
         },
        },

        {'name': 'UBC Asian Studies', 
         'api': 'https://asia.ubc.ca/wp-json/wp/v2/', 
         'categorize': {
            'default': 'community',
             'seminar_type': [570, 572, 571, 574, 739],
         },
        },

        {'name': 'UBC Central, Eastern, and Northern European Studies', 
         'api': 'https://cenes.ubc.ca/wp-json/wp/v2/',
        'categorize': {
            'default': 'community',
            'seminar_type': [552, 554, 559, 553, 677, 558],
            'hidden_title_terms': ['fika', 'plauder', 'kaffeestunde', 'slavic tea']
         },
        },    

        {'name': 'UBC English Language and Literatures', 
         'api': 'https://english.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
             'seminar_type': [512, 515, 510, 513]
         },
        },

        {'name': 'UBC French, Hispanic, and Itallian Studies', 
         'api': 'http://fhis.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [534, 537, 532]
         },
        },

        {'name': 'UBC Institute for Gender, Race, Sexuality and Social Justice', 
         'api': 'https://grsj.arts.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [512, 514, 632]
         },
        },

        {'name': 'UBC History', 
         'api': 'https://history.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [531, 525, 527, 526, 530]
         },
        },

        {'name': 'UBC Migration Studies', 
         'api': 'https://migration.ubc.ca/wp-json/wp/v2/', 
         'categorize': {
            'default': 'community',
            'seminar_type': [1208,1209,785,546,1206,1198],
            'hidden_title_terms': ['community luncheon'],
         },
        },

        {'name': 'UBC Pyschology', 
         'api': 'https://psych.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [433, 384, 906, 792, 377, 931, 560, 559]
         },
        },

        {'name': 'UBC School of Social Work', 
         'api': 'https://socialwork.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [520, 527, 525]
         },
        },

        {'name': 'UBC Faculty of Arts', 
         'api': 'https://www.arts.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'entertainment_type': [802],
            'seminar_type': [1962, 1785],
            'hidden_topics': [1783, 1950, 1996, 2378, 2379, 1995, 2375]
         },
        },

        {'name': 'UBC School of Information', 
         'api': 'https://ischool.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC Art History, Visual Art & Theory', 
         'api': 'https://ahva.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [820, 926, 817, 930, 824, 825]
         },
        },

        {'name': 'UBC Ancient Mediterranean and Near Eastern Studies', 
         'api': 'https://amne.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'community',
            'seminar_type': [718, 568, 570, 569]
         },
        },

        {'name': 'UBC Coordinated Arts Programs', 
         'api': 'https://cap.arts.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC School of Public Policy and Global Affairs', 
         'api': 'https://sppga.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC Geography', 
         'api': 'https://geog.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
            'hidden_title_terms': ['green day'],
         },
        },

        {'name': 'UBC Linguistics', 
         'api': 'https://linguistics.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC Philosophy', 
         'api': 'https://philosophy.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
            'community_title_terms': ['imagine day']
         },
        },

        {'name': 'UBC Political Science', 
         'api': 'https://politics.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
            'community_type': [544, 546, 549]
         },
        },

        {'name': 'UBC Theatre & Film', 
         'api': 'https://theatrefilm.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'entertainment',
            'seminar_type': [1262, 1263, 1265]
         },
        },

        {'name': 'UBC Sociology', 
         'api': 'https://sociology.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC School of Journalism, Writing, and Media', 
         'api': 'https://jwam.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'seminar',
         },
        },

        {'name': 'UBC School of Music', 
         'api': 'https://music.ubc.ca/wp-json/wp/v2/',
         'categorize': {
            'default': 'entertainment',
            'seminar_type': [562, 564, 567, 762, 563],
         },
        },
    ]

    terms = ['lecture', 'workshop', 'conference', 'talk', 'seminar', 'colloquia']
    for a in wp_apis:
        # Event.objects.wp_events_api_get_type_ids(a['api'], terms) # Uncomment to print the event-type id for types wuth the terms above in their name. Used for categorizing the events
        tasks.append(asyncio.create_task(Event.objects.read_wp_events_api(a['name'], a['api'], a['categorize'])))
        if len(tasks) >= max_at_a_time:
            await asyncio.gather(*tasks)
            tasks = []


    ical_files = [

        {'name': 'Go Thunderbirds', 
         'file': "https://gothunderbirds.ca/calendar.ashx/calendar.ics", 
         'create_function': Event.objects.gothunderbirds_create_event},

        {'name': 'UBC CS', 
         'file': "https://www.cs.ubc.ca/views/ical/related_events/calendar.ics", 
         'create_function': Event.objects.cs_ubc_create_event},

        {'name': 'UBC Statistics', 
         'file': "https://www.stat.ubc.ca/events-calendar-feed/", 
         'create_function': Event.objects.stats_ubc_create_event},

        {'name': 'UBCevents', 
         'file': "https://events.ubc.ca/events/?ical=1", 
         'create_function': Event.objects.ubcevents_create_event},

        {'name': 'Thunderbird Arena', 
         'file': "https://thunderbirdarena.ubc.ca/?tribe-bar-date=2024-" + str("%02d" % datetime.now().month) + "-01&ical=1", 
         'create_function': Event.objects.ical_create_event,
         'instructions': {
            'category': 'entertainment',
            'description_transform': lambda d : "",    
         }
        },

        {'name': 'Thunderbird Arena', 
         'file': "https://thunderbirdarena.ubc.ca/?tribe-bar-date=2024-" + str("%02d" % ((datetime.now().month%12) + 1)) + "-01&ical=1", 
         'create_function': Event.objects.ical_create_event,
         'instructions': {
            'category': 'entertainment',
            'description_transform': lambda d : "", 
         }
        },

        {'name': 'UBC Mathematics', 
         'file': "https://www.math.ubc.ca/news-events/events/ical", 
         'create_function': Event.objects.ical_create_event,
         'instructions': {
            'category': 'seminar',
         }
        },

        {'name': 'AMS', 
         'file': "https://www.ams.ubc.ca/events/?ical=1", 
         'create_function': Event.objects.ical_create_event,
         'instructions': {
            'category': 'community',
            'description_transform': lambda e : e.description.replace("UBC, UBC Vancouver, UBC students, UBC student life, UBC students, UBC events, events at UBC, UBC student events, UBC back to school, UBC back to school events, UBC campus, UBC campus events", ""),
         }
        },

        {'name': 'UBC Libraries', 
         'file': "https://libcal.library.ubc.ca/ical_subscribe.php?src=p&cid=7544", 
         'create_function': Event.objects.ical_create_event,
         'instructions': {
            'category': 'community',
            'hidden_override': lambda e : len(e.get('categories').cats) > 0, # The scheduled events are all cringe but well categorized. Events added manually can be cool but categories typically aren't added. At some point we should be more sophistiacted in filtering this lmao
         }
        },
    ]

    for f in ical_files:
        tasks.append(asyncio.create_task(Event.objects.read_ical(f)))
        if len(tasks) >= max_at_a_time:
            await asyncio.gather(*tasks)
            tasks = []

    await asyncio.gather(*tasks)

    async for event in Event.objects.filter(update_mode=2):
        await event.adelete()

    async for event in Event.objects.filter(hidden=True, end_time__lt=timezone.now()):
        await event.adelete()

    return HttpResponse("Success!", status=200)

def create_ical(request):
    from django.http import HttpResponse
    import icalendar

    cal = icalendar.Calendar()
    if request.GET.get('category'):
        cal['X-WR-CALNAME'] = request.GET.get('category').capitalize() + ' Around Campus from The Ubyssey'
        cal['X-ORIGINAL-URL'] = 'https://ubyssey.ca/events/?category=' + request.GET.get('category')
        cal['X-WR-CALDESC'] = request.GET.get('category').capitalize() + ' at UBC collected by The Ubyssey'
        all_events = Event.objects.filter(hidden=False, category=request.GET.get("category")).exclude(start_time=None, end_time=None)
    else:
        cal['X-WR-CALNAME'] = 'Events Around Campus from The Ubyssey'
        cal['X-ORIGINAL-URL'] = 'https://ubyssey.ca/events'
        cal['X-WR-CALDESC'] = 'Events at UBC collected by The Ubyssey'
        all_events = Event.objects.filter(hidden=False).exclude(category='seminar', start_time=None, end_time=None)

    for event in all_events:
        ical_event = icalendar.Event()
        ical_event.add('summary', event.title.replace("<br>", ""))
        ical_event.add('description', event.description)
        if event.address == None or event.address == "":
            ical_event.add('location', event.location)
        else:
            ical_event.add('location', event.location + ", " + event.address)
        ical_event.add('dtstart', event.start_time.astimezone(timezone.get_current_timezone()))
        ical_event.add('dtend', event.end_time.astimezone(timezone.get_current_timezone()))
        if request.GET.get('category'):
            ical_event.add('url', "https://ubyssey.ca/events/?category=" + request.GET.get('category') + "&event=" + event.hash)
        else:
            ical_event.add('url', "https://ubyssey.ca/events/?event=" + event.hash)
        ical_event.add('categories', event.category)
        ical_event.add('uid', event.hash)
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
            return Event.objects.filter(hidden=False, category=category, end_time__gte=timezone.now(), start_time__lte=timezone.now() + timedelta(days=7))
        else:
            return Event.objects.filter(hidden=False, end_time__gte=timezone.now(), start_time__lte=timezone.now() + timedelta(days=7)).exclude(category='seminar')

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
            item.link = "https://ubyssey.ca/events/?event=" + item.hash
        
        item.displayTime = format_event_date(item.start_time, item.end_time, weekDay=True)

        context["item"] = item

        return context

    def item_author_name(self, item):
        return item.host

    def item_link(self, item):
        return "https://ubyssey.ca/events/?event=" + item.hash

class EventsSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'start_time', 'end_time', 'location', 'address', 'host', 'email', 'event_url', 'hash', 'category']

class EventsViewSet(viewsets.ModelViewSet):
    serializer_class = EventsSerializer
    queryset = Event.objects.filter(hidden=False).order_by("start_time")
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = {
        'start_time': ['gte', 'lte'],
        'end_time': ['gte', 'lte'],
        'category': ['exact'],
        'location': ['exact'], 
        'host': ['exact'],
        'event_url': ['exact'],
    }
    search_fields = ['title', 'description', 'host', 'location', '^event_url']
