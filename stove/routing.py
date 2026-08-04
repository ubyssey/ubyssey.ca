from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"^ws/stove/manuscript/(?P<page_id>\d+)/yjs/?$",
        consumers.ManuscriptYjsConsumer.as_asgi(),
    ),
]
