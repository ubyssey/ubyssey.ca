# production.py , Django settings file
# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *
from google.oauth2 import service_account

import environ

env = environ.Env() # Scope issues without this line?

WAGTAILADMIN_BASE_URL = 'https://www.ubyssey.ca/'

ALLOWED_HOSTS = ['localhost', '*']

INTERNAL_IPS = ['127.0.0.1', '0.0.0.0', 'localhost']

INSTALLED_APPS += []

# Sessions are used to anonymously keep track of individual site visitors
SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'

CACHES = {
    'default': {
        'BACKEND': 'ubyssey.cache.AppEngineMemcacheCache',
        'TIMEOUT': 3600, # 1 hour
    },
    "renditions": {
        'BACKEND': 'ubyssey.cache.AppEngineMemcacheCache',
        'TIMEOUT': 3600, # 1 hour
    }
}

ADS_TXT_URL = 'https://ubyssey.storage.googleapis.com/ads.txt'

DEFAULT_FILE_STORAGE = 'ubyssey.storage.GCSMediaStorage'
STATICFILES_STORAGE = 'ubyssey.storage.GCSStaticFilesStorage'

GS_BUCKET_NAME = 'ubyssey'
GS_QUERYSTRING_AUTH = False
GS_FILE_OVERWRITE = False

UBYSSEY_ADVERTISING_EMAIL = env('UBYSSEY_ADVERTISING_EMAIL')

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440

ADMINS = [
	('Keegan', 'k.landrigan@ubyssey.ca'),
]
