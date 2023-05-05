from django.template import loader
from django.utils.html import mark_safe

from dispatch.theme import register
from dispatch.theme.widgets import Zone, Widget

from ubyssey.fields import EventField
from ubyssey.events.models import Event
from ubyssey.tests.helpers import DispatchTestHelpers

from dispatch.tests.cases import DispatchAPITestCase, DispatchMediaTestMixin
from dispatch.theme.exceptions import InvalidField, WidgetNotFound

class TestZone(Zone):
    id = 'test-zone'
    name = 'Test zone'

class TestEventWidget(Widget):
    id = 'test-event-widget'
    name = 'Test Event Widget'
    template = 'widgets/test-widget.html'

    zones = [TestZone]

    title = CharField('Title')
    description = TextField('Description')
    events = EventField('Featured Events')

    def context(self,data):

        data['events'] = Event.objects.filter(is_published=True).order_by('-start_time')

        return data

class WidgetRenderTestCase(DispatchAPITestCase, DispatchMediaTestMixin):

    def test_context_method(self):
        """Context method should add the two events"""

        register.zone(TestZone)
        register.widget(TestEventWidget)

        zone = TestZone()
        widget = TestEventWidget()

        DispatchTestHelpers.create_event(self.client, title='event 1', start_time='2017-05-24T12:00', is_published=True)
        DispatchTestHelpers.create_event(self.client, title='event 2', start_time='2017-05-25T12:00', is_published=True)

        validated_data = {
            'widget': 'test-widget',
            'data': {
              'title': 'test title 1',
              'description': 'test description'
            }
        }

        zone.save(validated_data)
        widget.set_data(validated_data['data'])

        html = u'<div class="widget">\n    <img class="title">test title 1</div>\n    <div class="description">test description</div>\n    \n    \n    \n      <div class="events">event 2</div>\n    \n      <div class="events">event 1</div>\n    \n</div>\n'

        result = widget.render(widget.context(widget.prepare_data()))

        self.assertEqual(result, html)
