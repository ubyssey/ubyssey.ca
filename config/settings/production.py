# production.py , Django settings file
# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *

import environ

env = environ.Env() #Scope issues without this line?

BASE_URL = 'https://www.ubyssey.ca/'
CANONICAL_DOMAIN = 'www.ubyssey.ca'

ALLOWED_HOSTS = [
    'ubyssey.ca',
    'www.ubyssey.ca',
    'ubyssey-prd.appspot.com',
]

INSTALLED_APPS += [
    'ubyssey.events',
    'django_user_agents',
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

# GCS File Storage - Production Only
DEFAULT_FILE_STORAGE = 'django_google_storage.storage.GoogleStorage'

GS_ACCESS_KEY_ID = env('GS_ACCESS_KEY_ID')
GS_SECRET_ACCESS_KEY = env('GS_SECRET_ACCESS_KEY')

GS_STORAGE_BUCKET_NAME = 'ubyssey'
GS_LOCATION = 'media'
GS_USE_SIGNED_URLS = True
GS_QUERYSTRING_AUTH = False

STATIC_URL = 'https://ubyssey.storage.googleapis.com/static/'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'gcs/static')
STATICFILES_DIRS += [
    os.path.join(DISPATCH_APP_DIR,'dispatch/static/manager'),
    os.path.join(BASE_DIR,'ubyssey/static/ubyssey/dist')
]

MEDIA_URL = 'https://ubyssey.storage.googleapis.com/media/'
ADS_TXT_URL = 'https://ubyssey.storage.googleapis.com/ads.txt'

# Facebook - Production Only
FACEBOOK_CLIENT_ID = env('FACEBOOK_CLIENT_ID')
FACEBOOK_CLIENT_SECRET = env('FACEBOOK_CLIENT_SECRET')

# Emails - Production Only
EMAIL_HOST = env('EMAIL_HOST')
EMAIL_PORT = 465
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
EMAIL_USE_SSL = True
UBYSSEY_ADVERTISING_EMAIL = env('UBYSSEY_ADVERTISING_EMAIL')

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440

ADMINS = [
	('Keegan', 'k.landrigan@ubyssey.ca'),
]