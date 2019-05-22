import re
import datetime

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.mail import send_mail
from django.core.urlresolvers import reverse
from django.shortcuts import render, redirect
from django.http import HttpResponse, Http404
from django.conf import settings
from django.forms.models import model_to_dict
from django.template.loader import render_to_string

from ubyssey.events.sources import FacebookEvent, UBCEvent, NoEventHandler, EventError
from ubyssey.events.forms import EventForm
from ubyssey.events.models import Event
from ubyssey.events.management.commands import import_events

def submit_landing(request):
    context = {
        'meta': {
            'title': 'Submit an Event',
            'description': 'Hosting an event on or off campus? Submit it to us and we\'ll feature it on our website!'
        }
    }

    return render(request, 'events/submit/landing.html', context)

def submit_success(request):
    context = {
        'meta': {
            'title': 'Submit an Event',
            'description': 'Thanks for your submission! Your event has been submitted for approval. We\'ll email you once it goes live on our site.'
        }
    }

    return render(request, 'events/submit/success.html', context)

def edit_success(request):
    context = {
        'meta': {
            'title': 'Edit an Event',
            'description': 'Thanks for your submission! Your event has been submitted for approval. We\'ll email you once it goes live on our site.'
        }
    }

    return render(request, 'events/submit/edit_success.html', context)

def submit_form(request):
    event_url = request.POST.get('event_url')
    url_error = False

    if request.POST.get('url_import') and event_url is not None:
        sources = {
            'calendar.events.ubc.ca': UBCEvent,
            'facebook.com': FacebookEvent
        }

        hostname = get_host_from_url(event_url)

        if hostname in sources:
            handler = sources[hostname]
        else:
            handler = NoEventHandler

        try:
            event = handler(event_url)
            data = event.get_data()
            data['event_type'] = event.event_type
            form = EventForm(initial=data)
        except EventError:
            url_error = True
            form = EventForm()

    elif request.method == 'POST':
        form = EventForm(request.POST, request.FILES)
        if form.is_valid():
            event = form.save(commit=False)
            event.is_submission = True
            event.save()

            return redirect(submit_success)
    else:
        form = EventForm()

    context = {
        'form': form,
        'url_error': url_error,
        'meta': {
            'title': 'Submit an Event',
            'description': 'Hosting an event on or off campus? Submit it to us and we\'ll feature it on our website!'
        }
    }

    return render(request, 'events/submit/form.html', context)

def event(request, event_id):
    try:
        event = Event.objects.get_published(event_id)
    except Event.DoesNotExist:
        raise Http404('Event could not be found.')

    upcoming = Event.objects \
        .filter(is_submission=False) \
        .filter(is_published=True) \
        .filter(start_time__gt=datetime.date.today()) \
        .order_by('start_time')[:3]

    related = Event.objects \
        .filter(is_submission=False) \
        .filter(is_published=True) \
        .filter(start_time__gt=datetime.date.today()) \
        .filter(category=event.category) \
        .exclude(id=event_id) \
        .order_by('start_time')[:2]

    context = {
        'meta': get_event_meta(event),
        'event': event,
        'upcoming': upcoming,
        'related': related,
        'info': get_submit_box()
    }

    return render(request, 'events/event.html', context)

def edit(request, secret_id):
    try:
        event = Event.objects.get_secret(secret_id)
    except Event.DoesNotExist:
        raise Http404('Event could not be found.')

    if request.method == 'GET':
        form = EventForm(instance=event)

    elif request.method == 'POST':
        form = EventForm(request.POST, request.FILES, instance=event)
        if form.is_valid():

            body = render_to_string('events/email/edit.html', {'secret_id': event.secret_id, 'title': event.title})

            send_mail(
                    'An event has been updated',
                    body,
                    settings.EMAIL_HOST_USER,
                    [settings.EVENT_EMAIL],
                    fail_silently=True,
                )

            form.save()

            return redirect(edit_success)

    else:
        form = EventForm()

    context = {
        'form': form,
        'meta': {
            'title': 'Edit an Event'
        }
    }

    return render(request, 'events/submit/form.html', context)

def events(request):
    category = request.GET.get('category')
    week = request.GET.get('week')

    if week:
        try:
            week_start = datetime.datetime.strptime(week, '%y-%m-%d').date()
        except:
            return redirect(calendar)

        # Date should be a Monday
        if week_start.weekday() != 0:
            return redirect(calendar)
    else:
        week_start = current_week()

    week_end = week_start + datetime.timedelta(weeks=1)

    events = Event.objects.get_events_in_week(week_start)

    context = {
        'meta': {
            'title': 'The Ubyssey - Events',
            'description': 'Upcoming campus events from UBC clubs and student organizations',
            'url': reverse('events')
        },
        'events': events,
        'weeks': upcoming_weeks(4),
        'week_start': week_start,
        'week_end': week_end,
        'today': datetime.date.today(),
        'category': category,
        'info':  get_submit_box()
    }

    return render(request, 'events/events.html', context)

def event_import(request):

    return import_events.update()

def get_event_meta(event):
    meta_image = None
    if event.image:
        meta_image = event.image.url

    return {
        'title': event.title,
        'description': event.description,
        'image': "%s%s" %(settings.BASE_URL, meta_image),
        'url': "%sevent/%s/" % (settings.BASE_URL, event.id)
    }

def get_host_from_url(url):
    """Parses URL against regex to pull out the hostname"""

    # Match numbers that is the event id from the url and return them
    m = re.search('.*(facebook\.com|calendar\.events\.ubc\.ca)+.*', url)

    if m:
        return m.group(1)
    else:
        return

def get_submit_box():
    return {
        'text': 'Hosting an event? Promote it for free on our website!',
        'link_text': 'Submit your event',
        'link': reverse(submit_landing)
    }

def current_week():
    """Returns a datetime.date object for Monday of the current week."""
    today = datetime.date.today()
    return today - datetime.timedelta(days=today.weekday())

def upcoming_weeks(n):
    """Returns a list of the next `n` upcoming weeks, where each week is a list of
    datetime.date objects.
    """
    today = datetime.date.today()
    start_monday = current_week()

    weeks = []

    for i in range(n):
        start_day = start_monday + datetime.timedelta(weeks=i)
        week = []

        for j in range(7):
            week.append(start_day + datetime.timedelta(days=j))

        weeks.append(week)

    return weeks
