import environ
from django.apps import AppConfig


class UbysseyConfig(AppConfig):
    name = "ubyssey"
    path = environ.Path(__file__) - 1
