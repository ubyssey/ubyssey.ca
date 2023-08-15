from dispatch.theme.fields import ModelField

from ubyssey.events.api.serializers import EventSerializer
from ubyssey.events.models import Event


class EventField(ModelField):
    type = "event"
    model = Event
    serializer = EventSerializer
