from datetime import datetime

import requests
from bs4 import BeautifulSoup

from dispatch.models import Article
from dispatch.theme import register
from dispatch.theme.widgets import Widget
from dispatch.theme.zones import Embed
from dispatch.theme.fields import (
    ModelField, CharField, TextField, ArticleField, ImageField,
    IntegerField, InvalidField, DateTimeField, BoolField, WidgetField
)

from ubyssey.events.models import Event
from ubyssey.zones import (
    ArticleHorizontal, ArticleSidebar, HomePageSidebarBottom,
    WeeklyEvents, FrontPage, SiteBanner
)
from ubyssey.fields import EventField

@register.widget
class EventWidget(Widget):
  id = 'event-widget'
  name = 'Event Widget'
  template = 'widgets/event.html'
  zones = (ArticleSidebar, Embed)

  event = EventField('Custom Event')

  def context(self, result):
      """Select random event if custom event is not specified"""

      if not result.get('event'):
          result['event'] = Event.objects.get_random_event()
      return result

@register.widget
class PrintIssue(Widget):
    id = 'print-issue'
    name = 'Print Issue'
    template = 'widgets/frontpage/print-issue.html'
    zones = (HomePageSidebarBottom, )

    issuu_url = TextField('Latest print issue url')
    issuu_img = TextField('Latest print issue cover image')

    def before_save(self, result):
        # Scraping the URL and cover image URL of Ubyssey's latest print issue
        page = requests.get('http://search.issuu.com/ubyssey/docs/recent.rss')
        soup = BeautifulSoup(page.content, 'xml')
        latestIssue = soup.findAll('item')[0]

        result['issuu_url'] = latestIssue.find('link').get_text()
        result['issuu_img'] = latestIssue.find('content').get('url')

        return result

@register.widget
class UpcomingEventsWidget(Widget):
    id = 'upcoming-events'
    name = 'Upcoming Events'
    template = 'widgets/upcoming-events.html'
    zones = (HomePageSidebarBottom, )

    featured_events = EventField('Featured Event(s)', many=True)
    featured_event_until = DateTimeField('Featured Event Time Limit')
    number_of_events = IntegerField('Number of Upcoming Events', min_value=0)

    def context(self, result):
        """Override context to add the next N events occuring to the context"""

        num_events = result['number_of_events']
        if num_events is None:
            num_events = 5

        if result['featured_event_until']:
           today = datetime.today()
           if today > result['featured_event_until'].replace(tzinfo=None):
               result['featured_events'] = None

        if result['featured_events']:
            exclusions = map(lambda e: e.pk, result['featured_events'])
        else:
            exclusions = []

        events = Event.objects \
            .filter(is_submission=False) \
            .filter(is_published=True) \
            .filter(start_time__gt=datetime.today()) \
            .exclude(pk__in=exclusions) \
            .order_by('start_time')[:num_events]

        result['upcoming'] = events

        return result

@register.widget
class WeeklyEventsWidget(Widget):
    id = 'weekly-events'
    name = 'Weekly Events'
    template = 'widgets/weekly-events.html'
    zones = (WeeklyEvents,)

    events = EventField('Featured Events', many=True)

    def context(self, data):
        data['events'] = data['events'] \
            .order_by('start_time') \
            .filter(is_published=True)[:5]
        return data

@register.widget
class UpcomingEventsHorizontalWidget(Widget):
    id = 'upcoming-events-horizontal'
    name = 'Upcoming Events Horizontal'
    template = 'widgets/upcoming-events-horizontal.html'
    zones = (ArticleHorizontal, )

    events = EventField('Override Events', many=True)

    def context(self, result):
        num = len(result['events'])

        # Target to display is 3
        if num < 3:
            events = Event.objects \
                .filter(is_submission=False) \
                .filter(is_published=True) \
                .filter(start_time__gt=datetime.today()) \
                .exclude(pk__in=map(lambda e: e.pk, result['events'])) \
                .order_by('start_time')[:3 - num]

            result['events'].extend(events)

        elif num > 3:
            result['events'] = result['events'][:3]

        return result

@register.widget
class FrontPageDefault(Widget):
    id = 'frontpage-default'
    name = 'Default Front Page'
    template = 'widgets/frontpage/default.html'
    zones = (FrontPage, )

    accepted_keywords = ('articles', )

    sidebar = WidgetField('Sidebar', [UpcomingEventsWidget], required=True)

def in_date_range(start, end):
    today = datetime.today()

    if start and today < start.replace(tzinfo=None):
        return False

    if end and today > end.replace(tzinfo=None):
        return False

    return True

@register.widget
class FacebookVideoBig(Widget):
    id = 'facebook-video-big'
    name = 'Facebook Video Big'
    template = 'widgets/frontpage/facebook-video-big.html'
    zones = (FrontPage, )

    title = CharField('Title')
    description = CharField('Description')
    host = CharField('Video Host (will display as author)')
    video_url = CharField('Video URL')
    show_comments = BoolField('Show Comment Box')

    start_time = DateTimeField('Start Time')
    end_time = DateTimeField('End Time')

    def context(self, result):
        result['do_show'] = in_date_range(result['start_time'], result['end_time'])
        return result

@register.widget
class AlertBanner(Widget):
    id = 'alert-banner'
    name = 'Alert Banner'
    template = 'widgets/alert-banner.html'
    zones = (SiteBanner, )

    text = CharField('Text')
    url = CharField('URL')

    start_time = DateTimeField('Start Time')
    end_time = DateTimeField('End Time')

    def context(self, result):

        result['do_show'] = in_date_range(result['start_time'], result['end_time'])
        return result
