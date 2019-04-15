# Deployment settings

import os

from dispatch.default_settings import *

SECRET_KEY = 'TEMP-KEY'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS += ['ubyssey.events', 'ubyssey.notifications']

STATICFILES_DIRS += (
    os.path.join(os.path.dirname(__file__), 'static/dist'),
)

STATIC_ROOT = '/home/travis/build/ubyssey/ubyssey.ca/gcs/static'
STATIC_URL = '/static/'
MEDIA_URL = '/media/'
