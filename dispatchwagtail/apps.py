from django.apps import AppConfig
import environ

class DispatchwagtailConfig(AppConfig):
    name = 'dispatchwagtail'
    path = environ.Path(__file__) - 1