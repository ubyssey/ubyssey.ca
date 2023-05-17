import calendar
import datetime
from pytz import timezone
from collections import OrderedDict
from random import randint

from django.conf import settings
from django.db.models import Manager, Count

class EventManager(Manager):
    def get_published(self, pk):
        return self.get(pk=pk, is_submission=False, is_published=True)

    def get_secret(self, secret_id):
        return self.get(secret_id=secret_id)

    def get_random_event(self):
        queryset = self.filter(is_published=True, end_time__gt=datetime.date.today())
        count = queryset.aggregate(count=Count('id'))['count']
        if (count > 0):
            random_index = randint(0, count - 1)
            return queryset[random_index]
        return None
        
    def get_events_in_week(self, start_day):
        start = start_day
        end = start_day + datetime.timedelta(weeks=1)

        return self.filter(
            is_published=True,
            start_time__gt=start,
            start_time__lte=end).order_by('start_time')

    def get_calendar_events(self, category=None, months=None, start=None, end=None):
        events = self.filter(is_submission=False) \
            .filter(is_published=True) \
            .order_by('start_time')

        today = datetime.date.today()
        # filter start
        if start is not None:
            events = events.filter(start_time__gt=start)
        else:
            events = events.filter(start_time__gt=today)

        # filter end
        if end is not None:
            events = events.filter(end_time__lte=end)
        else:
            until_month = today.month + (months if months is not None else 12)
            until_year = today.year
            while until_month > 12:
                until_month -= 12
                until_year += 1
            dt_until = today.replace(year=until_year, month=until_month)
            events = events.filter(end_time__lte=dt_until)

        if category is not None and category != 'all':
            events = events.filter(category__exact=category)

        HARD_MAX = 100
        events = events[:HARD_MAX]

        return events

    def group_events_by_date(self, events):
        events_by_date = OrderedDict()

        for event in events:
            start = event.start_time # Zulu
            start = start.astimezone(timezone(settings.TIME_ZONE))
            year = start.year
            month_name = calendar.month_name[start.month]
            day = '%s %d' % (start.strftime('%A'), start.day)
            if year not in events_by_date:
                events_by_date[year] = OrderedDict()
            if month_name not in events_by_date[year]:
                events_by_date[year][month_name] = OrderedDict()
            if day not in events_by_date[year][month_name]:
                events_by_date[year][month_name][day] = []

            events_by_date[year][month_name][day].append(event)

        return events_by_date
