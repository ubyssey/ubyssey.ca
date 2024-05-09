from django.apps import AppConfig
import environ

class UbysseyConfig(AppConfig):
    name = 'ubyssey'
    path = environ.Path(__file__) - 1