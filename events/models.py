from django.db import models
from images.models import UbysseyImage
from wagtail.snippets.models import register_snippet
from wagtail.admin.panels import FieldPanel

# Create your models here.

class EventManager(models.Manager):
    def create_event(self, ical_component):

        print(ical_component.get('summary'))

        if not self.filter(event_url=ical_component.get('url')).exists():
            event = self.create(
                title=ical_component.get('summary'),
                description=ical_component.get('description'),
                start_time=ical_component.decoded('dtstart'),
                end_time=ical_component.decoded('dtend'),
                location=ical_component.get('location'),
                mail=ical_component.decoded('organizer', default=""),
                event_url=ical_component.decoded('url')
            )
            if not ical_component.get("organizer", False):
                event.host = ical_component.get("organizer").params['cn']
            event.save()
            return event
        
        return None

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
        blank=False,
        null=False,
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
    ]

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['event_url']),
        ]
