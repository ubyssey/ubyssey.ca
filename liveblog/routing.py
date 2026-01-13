# chat/routing.py
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/liveblog/(?P<room_name>\w+)/$", consumers.LiveBlogConsumer.as_asgi()),
]