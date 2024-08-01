from django.db import models
from images.models import UbysseyImage
from wagtail.snippets.models import register_snippet
from wagtail.admin.panels import FieldPanel
from django.forms.widgets import Select
from django.utils import timezone
from datetime import datetime, time

# Create your models here.

class EventManager(models.Manager):
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
        event.hidden=self.ubcevents_judge_hidden(ical_component)

        if ical_component.get("organizer", False):
            event.host = ical_component.get("organizer").params['cn']

        event.update_mode = 1
        event.save()

        return event
    
    def ubcevents_judge_hidden(self, event):
        '''
        Returns True if event is online, not in UBC, or isn't for undergraduates
        '''
        
        title = event.get('summary')
        location = event.get('location').lower()
        description = event.get('description').lower()
        categories = event.get('categories')
        
        # Hide online events (the online events are cringe)
        if 'online' in location or 'virtual' in location:
            if not 'hybrid' in location and not 'in-person' in location:
                return True
        if 'see description' in location:
            if 'online' in description or 'virtual' in description or 'webinar' in description:
                if not 'hybrid' in location and not 'in-person' in location and not 'in-person' in description and not 'hybrid' in description:
                    return True            
        
        # Default to showing events when there are no categories listed
        if not categories:
            return False

        categories = categories.to_ical().decode().lower()

        # Hide events that aren't for undergraduates
        if 'audience' in categories:
            if 'all students' not in categories and 'audience – community' not in categories:
                return True
        if 'staff only' in title:
            return True
            
        # Hide UBC Okanagan exclusive events
        if 'okanagan' in categories and not 'vancouver' in categories:
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
        for i in ['workshop', 'seminar', 'research', 'learning']:
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


@register_snippet
class Event(models.Model):
    title = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    description = models.TextField(
        null=False,
        blank=True,
        default='',
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
