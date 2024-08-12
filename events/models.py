from django.db import models
from images.models import UbysseyImage
from wagtail.snippets.models import register_snippet
from wagtail.admin.panels import FieldPanel
from django.forms.widgets import Select
from django.utils import timezone
from datetime import datetime, time, timedelta
from urllib.request import urlopen, Request
from django.http import HttpResponse
import json
from urllib.request import urlopen, Request
from icalendar import Calendar
from django.http import HttpResponse
# Create your models here.

class EventManager(models.Manager):

    def read_ical(self, name, file, create_function):
        
        try:
            req = Request(file, headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
            con = urlopen(req)

            cal = Calendar.from_ical(con.read())
            for component in cal.walk():
                if component.name == "VEVENT":
                    create_function(component)
            
        except:
            return HttpResponse("Failed requesting to " + name, status=500)

    def read_wp_events_api(self, name, api, category):

        req = Request(api + "events/?order=desc&page=1&per_page=20", headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
        con = urlopen(req)
        result = json.loads(con.read())
        for i in result:
            self.wp_events_api_create_event(i, api, name, category)

    def wp_events_api_create_event(self, event_json, api, host, category):
        if not self.filter(event_url=event_json['link']).exists():
            event = self.create(
                title=event_json['title'],
                event_url=event_json['link'],
            )
        else:
            event = self.get(event_url=event_json['link'])
            if event.update_mode != 2:
                return None
            
        event.title = str(event_json['title']['rendered'].encode('utf-8'), 'UTF-8')
        event.description = str(event_json['excerpt']['rendered'].encode('utf-8'), 'UTF-8')

    	# "2024-08-09T12:00:00-07:00"
        start = datetime.fromisoformat(event_json['start']).astimezone(timezone.get_current_timezone())
        end = datetime.fromisoformat(event_json['end']).astimezone(timezone.get_current_timezone())
        event.start_time = start
        event.end_time = end

        if len(event_json['event-venues']) > 0:
            req = Request(api + 'event-venues/' + str(event_json['event-venues'][0]), headers={'User-Agent': "The Ubyssey https://ubyssey.ca/"})
            con = urlopen(req)
            venue = json.loads(con.read())
            event.location=str(venue['name'].encode('utf-8'), 'UTF-8')
            event.address=str((venue['address'] + ", " + venue['city'] + ", " + venue['state']).encode('utf-8'), 'UTF-8')
        else:
            event.location=''
            event.address=''

        event.email=''
        event.event_url=event_json['link']
        event.category = category
        event.hidden=False

        event.host = host

        event.update_mode = 1
        event.save()


    def ubcevents_create_event(self, ical_component):
        if not self.filter(event_url=ical_component.get('url')).exists():
            event = self.create(
                title=ical_component.get('summary'),
                event_url=ical_component.decoded('url'),
            )
        else:
            event = self.get(event_url=ical_component.get('url'))
            if event.update_mode != 2:
                return None

        # Split location and address
        location = ical_component.get('location')
        address = ""
        if "," in location:
            address = location[location.index(',')+1:]
            location = location[:location.index(',')]

        
        event.title=ical_component.get('summary')
        event.description=ical_component.get('description')

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.start_time=ical_component.decoded('dtstart').astimezone(timezone.get_current_timezone())
        else:
            event.start_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend').astimezone(timezone.get_current_timezone())
        else:
            event.end_time=datetime.combine(ical_component.decoded('dtend'), time(), tzinfo=timezone.get_current_timezone())
            
        event.address=address
        event.location=location
        event.email=ical_component.decoded('organizer', default="")
        event.event_url=ical_component.decoded('url')
        event.category = self.ubcevents_category(ical_component)
        event.hidden=self.ubcevents_judge_hidden(event, ical_component)

        if ical_component.get("organizer", False):
            event.host = ical_component.get("organizer").params['cn']

        event.update_mode = 1
        event.save()

        return event
    
    def ubcevents_judge_hidden(self, event, ical):
        '''
        Returns True if event is online, not in UBC, or isn't for undergraduates
        '''

        title = event.title.lower()
        location = event.location.lower()
        description = event.description.lower()
        categories = ical.get('categories')
        
        # Hide events that are already listed in other feeds we read
        if self.filter(title=event.title, start_time=event.start_time).exclude(event_url=event.event_url).exists():
            return True

        # Hide online events (the online events are cringe)
        if 'online' in location or 'virtual' in location:
            if not 'hybrid' in location and not 'in-person' in location:
                return True
        if 'see description' in location:
            if 'online' in description or 'virtual' in description or 'webinar' in description:
                if not 'hybrid' in location and not 'in-person' in location and not 'in-person' in description and not 'hybrid' in description:
                    return True            
        
        # Hide events with certain terms in the title
        # The two listed right now are on an inaccurate repeating schedule
        for i in ['coffee hour', 'advanced research computing summer school']:
            if i in title:
                return True

        # Default to showing events when there are no categories listed
        if not categories:
            return False

        categories = categories.to_ical().decode().lower()

        # Hide events that aren't for undergraduates
        if 'audience' in categories:
            if 'students' not in categories and 'audience – community' not in categories:
                return True
        if 'staff only' in title:
            return True
            
        # Hide UBC Okanagan exclusive events
        if 'okanagan' in categories and not 'vancouver' in categories:
            return True
        
        # Hide events from certain organizers
        if ical.get("organizer", False):
            host = ical.get("organizer").params['cn'].lower()
            for i in ['ubc career centre']:
                if i in host:
                    return True
                
        # If it passes all these tests its probably good
        return False

    def ubcevents_category(self, event):
        '''
        Return the category the event is judged to belong to
        '''
        categories = event.get('categories')
        title = event.get('summary').lower()

        # Set farmer's markets events to community even though UBCevents tags them as entertainment for some reason
        for i in ['lunch', 'market', 'ubc farm']:
            if i in title:
                return 'community'

        # Hide events without categories because there isn't enough information
        if not categories:
            return 'community'

        categories = categories.to_ical().decode().lower()

        # Check for seminar keywords  
        for i in ['workshop', 'seminar', 'research', 'learning', 'conference', 'graduate students']:
            if i in categories:
                return 'seminar'
            
        # Check for entertainmnet keywords
        for i in ['entertainment', 'concert', 'perform']:
            if i in categories:
                return 'entertainment'
            
        # Check for sports keywords
        for i in ['thunderbird athletics']:
            if i in categories:
                return 'sports'

        return 'community'

    def gothunderbirds_create_event(self, ical_component):

        if not self.filter(event_url=ical_component.get('url').replace("&amp;", "__AND__")).exists():
            event = self.create(
                title=ical_component.get('summary'),
                event_url=ical_component.decoded('url').replace("&amp;", "__AND__"),
            )
        else:
            event = self.get(event_url=ical_component.get('url').replace("&amp;", "__AND__"))
            if event.update_mode != 2:
                return None

        # Split location and address
        address = ical_component.get('location')
        location = address.replace('Vancouver, B.C., ', '')

        g = ""
        if "Men's" in ical_component.get('summary'):
            g = "M. "
        elif "Women's" in ical_component.get('summary'):
            g = "W. "
        event.title=g + ical_component.get('summary').replace("UBC ", "").replace("vs", "<br>UBC vs").replace("Men's ", "").replace("Women's ", "")

        event.description=" ".join(ical_component.get('description').split(" ")[0:-1])

        splitDesc = ical_component.get('description').split(" ")
        i = 0
        while splitDesc[i][0].isupper():
            i = i + 1
        sport = " ".join(splitDesc[0:i])
        sport = sport.replace("Men's ", "").replace("Women's ", "").replace("UBC ", "")
        event.host = sport

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.start_time=ical_component.decoded('dtstart').astimezone(timezone.get_current_timezone())
        else:
            event.start_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend').astimezone(timezone.get_current_timezone())
        else:
            if ical_component.decoded('dtend').day - ical_component.decoded('dtstart').day == 1:
                event.end_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())
            else:
                event.end_time=datetime.combine(ical_component.decoded('dtend'), time(), tzinfo=timezone.get_current_timezone())

        event.address=address
        event.location=location
        event.event_url=ical_component.decoded('url').replace("&amp;", "__AND__")
        event.category='sports'
        event.hidden=self.gothunderbirds_judge_hidden(ical_component)

        event.update_mode = 1
        event.save()

        return event
    
    def gothunderbirds_judge_hidden(self, event):
        '''
        Returns True if event is online, isn't for undergraduates, or doesn't have enough information to categorize
        '''
        
        location = event.get('location').lower()
        
        # Hide events that are not in Vancouver
        if 'vancouver' not in location:
            return True
        
        # Otherwise assume its good
        return False
    def phas_ubc_create_event(self, event_component):
        # Extract event url
        a_tag = event_component.find('div', class_='event-title').find('a')
        href_value = a_tag['href']
        event_url = f"https://phas.ubc.ca{href_value}"

        # Extract title
        title_span = event_component.find('span', class_='title')
        title = title_span.find('span', class_='field field--name-title field--type-string field--label-hidden')
        title = title.get_text(strip=True)

        # Check if event exists and create or update accordingly
        if not self.filter(event_url=event_url).exists():
            event = self.create(
                title=title,
                event_url=event_url,
            )
        else:
            event = self.get(event_url=event_url)
            if event.update_mode != 2:
                return None

        # Extract start time
        start_time_str = event_component.find('span', class_='start').get_text(strip=True)
        parsed_start_time = datetime.fromisoformat(start_time_str)
        current_tz = timezone.get_current_timezone()
        start_time = datetime.combine(parsed_start_time.date(), parsed_start_time.time(), tzinfo=current_tz)
        
        # Extract location
        location_span = event_component.find('span', class_='location')
        location = location_span.get_text(strip=True).replace("Event Location:", "").strip()
        
        # Extract description
        description_span = event_component.find('span', class_='description')
        description_text = description_span.get_text(strip=True)
        description = description_text if description_text != "Abstract:" else ""

        # Extract end time
        end_time_str = event_component.find('span', class_='end').get_text(strip=True)
        parsed_end_time = datetime.fromisoformat(end_time_str)
        end_time = datetime.combine(parsed_end_time.date(), parsed_end_time.time(), tzinfo=current_tz)

        '''
        Extract speaker
        p_tags = event_component.find_all('p')
        for p_tag in p_tags:
            if 'Speaker:' in p_tag.get_text():
                p_text = p_tag.get_text(separator=' ', strip=True)
                host = p_text.split('Speaker:')[1].split('|')[0].strip()
                break
        '''            
        
        # Update event details
        event.title = title
        event.description = description
        event.start_time = start_time
        event.end_time = end_time
        event.location = location
        event.category = 'seminar'
        event.hidden = False
        event.host = 'UBC Physics & Astronomy'
        event.update_mode = 1
        event.save()
        
        return event
    
    def cs_ubc_create_event(self, ical_component):
        if not self.filter(event_url=ical_component.get('url')).exists():
            event = self.create(
                title=ical_component.get('summary'),
                event_url=ical_component.decoded('url'),
            )
        else:
            event = self.get(event_url=ical_component.get('url'))
            if event.update_mode != 2:
                return None

        event.title=ical_component.get('summary')
        event.description= "<br>" + ical_component.get('description').replace("&amp;", "&")

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.start_time=ical_component.decoded('dtstart').astimezone(timezone.get_current_timezone())
        else:
            event.start_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend').astimezone(timezone.get_current_timezone())
        else:
            event.end_time=datetime.combine(ical_component.decoded('dtend'), time(), tzinfo=timezone.get_current_timezone())
            
        event.location = ical_component.get('location')

        if "Location: " in ical_component.get('description'):
            s = ical_component.get('description')[ical_component.get('description').index("Location: ") + len("Location: "):]
            event.location = s[:s.index("\n")]

        event.event_url = ical_component.get("url")
        event.email=""
        event.category = self.cs_ubc_category(ical_component)
        event.hidden = self.cs_ubc_judge_hidden(ical_component)

        event.host = "UBC Computer Science"

        event.update_mode = 1
        event.save()

        return event

    def cs_ubc_judge_hidden(self, event):
        '''
        Returns True if event has no description or has cringe keywords
        '''
                
        # Hide events that have no description (because for some reason some have no description)
        if not event.get('description'):
            return True

        # Check for cringe keywords  
        for i in ['interview', 'resume']:
            if i in event.get('summary').lower():
                return True

        # Otherwise assume its good
        return False

    def cs_ubc_category(self, event):

        # Check for seminar keywords  
        for i in ['workshop', 'seminar', 'talk', 'thesis', 'presentation', 'phd defence']:
            if i in event.get('summary').lower():
                return 'seminar'
            
        return 'community'
    
    
    def stats_ubc_create_event(self, ical_component):
        if timedelta(days=30) > abs(timezone.now() - ical_component.decoded('dtstart').astimezone(timezone.get_current_timezone())):
            if not self.filter(event_url=ical_component.get('url')).exists():
                event = self.create(
                    title=ical_component.get('summary'),
                    event_url=ical_component.decoded('url'),
                )
            else:
                event = self.get(event_url=ical_component.get('url'))
                if event.update_mode != 2:
                    return None
        else:
            return None

        event.title=ical_component.get('summary')
        
        # Clean up event description because they are so messy and have unnecessary information
        description = str(ical_component.decoded('description'), 'UTF-8')
        safety = 10
        while "Speaker" in description and "Description" in description:
            description = description.replace(description[description.index("Speaker"):description.index("Description") + len("Description")], "")
            safety = safety - 1
            if safety < 1:
                break
        while "  " in description:
            description = description.replace("  ", " ")
        while "\n " in description:
            description = description.replace("\n ", "\n")
        while "\n\n\n" in description:
            description = description.replace("\n\n\n", "\n\n")
        event.description = description

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.start_time=ical_component.decoded('dtstart').astimezone(timezone.get_current_timezone())
        else:
            event.start_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend').astimezone(timezone.get_current_timezone())
        else:
            event.end_time=datetime.combine(ical_component.decoded('dtend'), time(), tzinfo=timezone.get_current_timezone())
            
        event.location = ical_component.get('location')

        event.event_url = ical_component.get("url")
        event.email=""
        event.category = "seminar"
        event.hidden = self.stats_ubc_judge_hidden(ical_component)

        event.host = "UBC Statistics"

        event.update_mode = 1
        event.save()

        return event


    def stats_ubc_judge_hidden(self, event):
        '''
        Filter out the categories 'Student Events' and 'STEM Education'
        bececause they don't seem to apply to most undergraduate students.
        This can be reevaluated in the future when there are more events in this category
        https://www.stat.ubc.ca/event-type/student-event
        https://www.stat.ubc.ca/event-type/stem-education
        '''

        for i in ['student events', 'stem education']:
            if i in event.get('description').lower():
                return True

        # Otherwise assume its good
        return False
          
@register_snippet
class Event(models.Model):
    title = models.CharField(
        max_length=255,
        blank=False,
        null=False,
        db_collation = "utf8mb4_general_ci",
    )
    description = models.TextField(
        null=False,
        blank=True,
        default='',
        db_collation = "utf8mb4_general_ci",
    )
    start_time = models.DateTimeField(
        null=True,
        blank=True
    )
    end_time = models.DateTimeField(
        null=True,
        blank=True
    )
    location = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    address = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    host = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    email = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    event_url = models.URLField(
        null=True,
        blank=True,
    )
    image = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    hidden = models.BooleanField(
        default=False,
        editable=True,
        help_text="Events that are only online, aren't for undergraduates, or don't have enough information to categorize should be automatically hidden. This means they don't show on the calendar.",
    )
    category = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        default='',
    )
    # 0: manually inputted so don't delete on updates, 1: updated by cronjob, 2: currently updating by cronjob
    update_mode = models.IntegerField(
        default=0,
        help_text="Make sure you select 'Manual input', otherwise this event will be overwritten or deleted during the calendar's automatic daily update"
    )

    objects = EventManager()

    panels = [
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("start_time"),
        FieldPanel("end_time"),
        FieldPanel("location"),
        FieldPanel("address"),
        FieldPanel("host"),
        FieldPanel("event_url"),
        FieldPanel("image"),
        FieldPanel(
            "category",
            widget=Select(
                choices=[
                    ('', 'All'), 
                    ('sports','Sports'),
                    ('entertainment','Entertainment'),
                    ('community','Community'),
                    ('seminar', 'Seminar'),
                ],
            ),
        ),
        FieldPanel("hidden"),
        FieldPanel(
            "update_mode",
            widget=Select(
                choices=[
                    (0, 'Manual input'), 
                    (1,'Updated by cronjob'),
                ],
            ),
        ),
    ]

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['event_url']),
        ]
