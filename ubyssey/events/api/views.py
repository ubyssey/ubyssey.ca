from django.db.models import Q

from rest_framework import viewsets, mixins, filters, status

from dispatch.api.mixins import DispatchModelViewSet

from ubyssey.events.models import Event
from ubyssey.events.api.serializers import EventSerializer

class EventViewSet(DispatchModelViewSet):
    model = Event
    serializer_class = EventSerializer

    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ('start_time',)
    ordering = ('-start_time',)

    def get_queryset(self):

        if self.request.user.is_authenticated:
            queryset = Event.objects.all()
        else:
            queryset = Event.objects.filter(
                Q(is_submission=False),
                Q(is_published=True)
            )

        q = self.request.query_params.get('q', None)
        pending = self.request.query_params.get('pending', None)

        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) |
                Q(description__icontains=q) |
                Q(host__icontains=q) |
                Q(category__iexact=q)
            )

        if pending == '1':
            queryset = queryset.filter(is_submission=True)
        elif pending == '0':
            queryset = queryset.filter(is_submission=False)

        return queryset
