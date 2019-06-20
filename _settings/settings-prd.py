import os
from dispatch.default_settings import *
from google.cloud import datastore
client = datastore.Client()

BASE_URL = 'https://www.ubyssey.ca/'
CANONICAL_DOMAIN = 'www.ubyssey.ca'

def getValue(theKey):
    query = client.query(kind='Secrets')
    query.add_filter('key', '=', theKey)
    key = client.key('Secrets', list(query.fetch())[0].id)
    entity = client.get(key)
    return entity['value']

SECRET_KEY = getValue('SECRET_KEY')
NOTIFICATION_KEY = getValue('NOTIFICATION_KEY')

VERSION = '1.5.58'

ALLOWED_HOSTS = [
    'ubyssey.ca',
    'www.ubyssey.ca',
    'ubyssey-prd.appspot.com',
]

INSTALLED_APPS += [
    'ubyssey',
    'ubyssey.events',
    'django_user_agents',
]

ROOT_URLCONF = 'ubyssey.urls'

USE_TZ = True

TIME_ZONE = 'America/Vancouver'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'HOST': getValue('SQL_HOST'),
        'NAME': getValue('SQL_DATABASE'),
        'USER': getValue('SQL_USER'),
        'PASSWORD': getValue('SQL_PASSWORD'),
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

SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
        'LOCATION': '127.0.0.1:11211',
    }
}

MIDDLEWARE += [
    'canonical_domain.middleware.CanonicalDomainMiddleware',
]

# GCS File Storage
DEFAULT_FILE_STORAGE = 'django_google_storage.storage.GoogleStorage'

GS_ACCESS_KEY_ID = getValue('GS_ACCESS_KEY_ID')
GS_SECRET_ACCESS_KEY = getValue('GS_SECRET_ACCESS_KEY')

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
FACEBOOK_CLIENT_ID = getValue('FACEBOOK_CLIENT_ID')
FACEBOOK_CLIENT_SECRET = getValue('FACEBOOK_CLIENT_SECRET')

# Emails
EMAIL_HOST = getValue('EMAIL_HOST')
EMAIL_PORT = 465
EMAIL_HOST_USER = getValue('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = getValue('EMAIL_HOST_PASSWORD')
EMAIL_USE_SSL = True
UBYSSEY_ADVERTISING_EMAIL = getValue('UBYSSEY_ADVERTISING_EMAIL')

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
