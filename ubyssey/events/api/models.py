import os
import tempfile

import requests
from phonenumber_field.modelfields import PhoneNumberField
import uuid

from django.db.models import (
    Model, DateTimeField, CharField, TextField,
    ImageField, BooleanField, EmailField, UUIDField)
from django.core.files import File
from django.dispatch import receiver
from django.template.loader import render_to_string
from django.conf import settings
from django.core.mail import send_mail
from django.db.models.signals import post_save, pre_save

from ubyssey.events.managers import EventManager

class Event(Model):
    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    secret_id = UUIDField(default=uuid.uuid4, editable=False)
    title = CharField(max_length=255)
    description = TextField()
    host = CharField(max_length=255)

    image = ImageField(upload_to='images/events/', null=True, blank=True)

    start_time = DateTimeField(null=True)
    end_time = DateTimeField(null=True)

    location = CharField(max_length=500)
    address = CharField(max_length=500, null=True, blank=True)

    CATEGORY_CHOICES = (
        ('sports', 'Sports'),
        ('music', 'Music'),
        ('academic', 'Academic'),
        ('party', 'Party'),
        ('business', 'Business'),
        ('ceremony', 'Ceremony'),
        ('workshop', 'Workshop'),
        ('clubs', 'Clubs'),
        ('other', 'Other')
    )

    category = CharField(max_length=20, choices=CATEGORY_CHOICES)
    event_type = CharField(max_length=30, default=None, null=True, blank=True)

    event_url = TextField(null=True, blank=True)
    ticket_url = TextField(null=True, blank=True)

    is_submission = BooleanField(default=False)
    is_submission_email = BooleanField(default=False)
    is_published = BooleanField(default=False)
    is_published_email = BooleanField(default=False)

    submitter_email = EmailField(null=True)
    submitter_phone = PhoneNumberField(null=True, blank=True)

    objects = EventManager()

    def save_image_from_url(self, url):
        """Store image locally if an external URL is passed"""
        result = requests.get(url)

        filename = os.path.basename(url).split('?')[0]

        # Use tempfile.TemporaryFile for App Engine
        temp = tempfile.TemporaryFile()
        temp.write(result.content)
        temp.flush()

        self.image.save(filename, File(temp))
        self.save()

    def get_absolute_image_url(self):
        """
        Returns image URL.
        """
        if self.image:
            return settings.MEDIA_URL + str(self.image)

@receiver(pre_save, sender=Event)
def send_submitted_email(sender, instance, **kwargs):
    """Send an email to the submitter when the event is submitted."""
    if instance.is_submission and not instance.is_submission_email:
        body = render_to_string('events/email/submitted.html', {'title': instance.title, 'secret_id': instance.secret_id})

        send_mail(
            'Your event has been submitted!',
            body,
            settings.EMAIL_HOST_USER,
            [instance.submitter_email],
            fail_silently=True,
        )

        instance.is_submission_email = True
        instance.save()


@receiver(pre_save, sender=Event)
def format_event_ticket_url(sender, instance, **kwargs):
    """Add "http://" in front of (non-empty) event_url and ticket_url if protocol missing."""
    instance.event_url = format_url(instance.event_url);
    instance.ticket_url = format_url(instance.ticket_url);

def has_protocol(url):
    return url.startswith('http://') or url.startswith('https://')

def format_url(url):
    if not url or has_protocol(url):
        return url
    else:
        return "http://" + url


@receiver(post_save, sender=Event)
def send_published_email(sender, instance, **kwargs):
    """Send an email to the submitter when the event has been published."""
    if instance.is_published and not instance.is_published_email:
        body = render_to_string('events/email/success.html', {'id': instance.id})

        send_mail(
                'Your event has been published!',
                body,
                settings.EMAIL_HOST_USER,
                [instance.submitter_email],
                fail_silently=True,
            )

        instance.is_published_email = True
        instance.save()

class ScrapedEvent(Model):
    """Model to keep track of events that have been scraped from UBC Event RSS"""

    guid = CharField(max_length=50, primary_key=True)
    scrape_time = DateTimeField(null=True)
