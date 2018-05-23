from ubyssey.events.models import Event
from dispatch.api.mixins import DispatchModelSerializer

class EventSerializer(DispatchModelSerializer):

    class Meta:
        model = Event

        fields = (
            'id',
            'secret_id',
            'title',
            'description',
            'host',
            'image',
            'start_time',
            'end_time',
            'location',
            'address',
            'category',
            'event_type',
            'event_url',
            'ticket_url',
            'is_published',
            'is_submission',
            'submitter_email',
            'submitter_phone',
        )

        authenticated_fields = (
            'secret_id',
            'submitter_email',
            'submitter_phone'
        )
