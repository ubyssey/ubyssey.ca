from django.apps import AppConfig
import environ

class ConfigConfig(AppConfig):
    name = 'config'
    path = environ.Path(__file__) - 1