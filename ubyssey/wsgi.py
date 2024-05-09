import os

from django.core.wsgi import get_wsgi_application

from google.appengine.api import wrap_wsgi_app

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = wrap_wsgi_app(get_wsgi_application())
