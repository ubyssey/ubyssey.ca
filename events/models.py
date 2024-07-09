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

        # Split location and address
        location = ical_component.get('location')
        address = ""
        if "," in location:
            address = location[location.index(',')+1:]
            location = location[:location.index(',')]

        
        event.title=ical_component.get('summary')
        event.description=ical_component.get('description')

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.end_time=ical_component.decoded('dtstart')
        else:
            event.end_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend')
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

        event.save()

        return event
        
    
    def ubcevents_judge_hidden(self, event):
        '''
        Returns True if event is online, isn't for undergraduates, or doesn't have enough information to categorize
        '''
        
        title = event.get('summary')
        location = event.get('location').lower()
        description = event.get('description').lower()
        categories = event.get('categories')
        
        # Hide events without categories becausee there isn't enough information
        if not categories:
            return True

        categories = categories.to_ical().decode().lower()

        # Hide online events (the online events are cringe)
        if 'online' in location or 'virtual' in location:
            if not 'hybrid' in location and not 'in-person' in location:
                return True
        if 'see description' in location:
            if 'online' in description or 'virtual' in description or 'webinar' in description:
                if not 'hybrid' in location and not 'in-person' in location and not 'in-person' in description and not 'hybrid' in description:
                    return True            
        
        # Hide events that aren't for undergraduates
        if 'audience' in categories:
            if 'all students' not in categories and 'community' not in categories:
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
        for i in ['lunch', 'market']:
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

        # Split location and address
        address = ical_component.get('location')
        location = address.replace('Vancouver, B.C., ', '')

        g = ""
        if "Men's" in ical_component.get('summary'):
            g = "M. "
        elif "Women's" in ical_component.get('summary'):
            g = "W. "
        event.title=g + ical_component.get('summary').replace("UBC ", "").replace("vs", "<br>UBC vs").replace("Men's ", "").replace("Women's ", "")

        event.description=ical_component.get('description')

        if isinstance(ical_component.decoded('dtstart'), datetime):
            event.end_time=ical_component.decoded('dtstart')
        else:
            event.end_time=datetime.combine(ical_component.decoded('dtstart'), time(), tzinfo=timezone.get_current_timezone())

        if isinstance(ical_component.decoded('dtend'), datetime):
            event.end_time=ical_component.decoded('dtend')
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
        FieldPanel("hidden")
    ]

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['event_url']),
        ]
