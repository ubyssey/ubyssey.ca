import os

from ubyssey.secrets import Secrets

from dispatch.default_settings import *

BASE_URL = 'https://www.ubyssey.ca/'
CANONICAL_DOMAIN = 'www.ubyssey.ca'

SECRET_KEY = Secrets.get('SECRET_KEY')
NOTIFICATION_KEY = Secrets.get('NOTIFICATION_KEY')

VERSION = '1.4.130'

ALLOWED_HOSTS = [
    'ubyssey.ca',
    'www.ubyssey.ca',
    'ubyssey-prd.appspot.com',
]

INSTALLED_APPS += [
    'ubyssey',
    'ubyssey.events',
    'ubyssey.notifications',
    'django_user_agents',
]

ROOT_URLCONF = 'ubyssey.urls'

USE_TZ = True

TIME_ZONE = 'America/Vancouver'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'HOST': Secrets.get('SQL_HOST'),
        'NAME': Secrets.get('SQL_DATABASE'),
        'USER': Secrets.get('SQL_USER'),
        'PASSWORD': Secrets.get('SQL_PASSWORD'),
        'PORT': 3306,
    }
}

TEMPLATES += [
    {
        'NAME': 'ubyssey',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(os.path.dirname(__file__), 'templates'),
        ]
    }
]

SESSION_ENGINE = 'gae_backends.sessions.cached_db'
CACHES = {
    'default': {
        'BACKEND': 'gae_backends.memcache.MemcacheCache',
    }
}

MIDDLEWARE_CLASSES += [
    'canonical_domain.middleware.CanonicalDomainMiddleware',
]

# GCS File Storage
DEFAULT_FILE_STORAGE = 'django_google_storage.storage.GoogleStorage'

GS_ACCESS_KEY_ID = Secrets.get('GS_ACCESS_KEY_ID')
GS_SECRET_ACCESS_KEY = Secrets.get('GS_SECRET_ACCESS_KEY')
GS_STORAGE_BUCKET_NAME = 'ubyssey'
GS_LOCATION = 'media'
GS_USE_SIGNED_URLS = True
GS_QUERYSTRING_AUTH = False

STATICFILES_DIRS += (
    os.path.join(os.path.dirname(__file__), 'static/dist'),
)

STATIC_URL = 'https://ubyssey.storage.googleapis.com/static/'
MEDIA_URL = 'https://ubyssey.storage.googleapis.com/media/'

# Facebook
FACEBOOK_CLIENT_ID = Secrets.get('FACEBOOK_CLIENT_ID')
FACEBOOK_CLIENT_SECRET = Secrets.get('FACEBOOK_CLIENT_SECRET')

EMAIL_HOST = Secrets.get('EMAIL_HOST')
EMAIL_PORT = 465
EMAIL_HOST_USER = Secrets.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = Secrets.get('EMAIL_HOST_PASSWORD')
EMAIL_USE_SSL = True

UBYSSEY_ADVERTISING_EMAIL = Secrets.get('UBYSSEY_ADVERTISING_EMAIL')

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
