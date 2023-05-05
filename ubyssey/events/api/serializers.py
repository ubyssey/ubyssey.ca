from ubyssey.events.models import Event
from dispatch.api.mixins import DispatchModelSerializer
from rest_framework import serializers
from dispatch.api.validators import FilenameValidator

class EventSerializer(DispatchModelSerializer):

    image = serializers.ImageField(required=False, validators=[FilenameValidator], write_only=True)

    image_url = serializers.CharField(source='get_absolute_image_url', read_only=True)

    class Meta:
        model = Event

        fields = (
            'id',
            'secret_id',
            'title',
            'description',
            'host',
            'image',
            'image_url',
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
