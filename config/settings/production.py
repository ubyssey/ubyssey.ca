# production.py , Django settings file
# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *
from google.oauth2 import service_account

import environ
import sys

env = environ.Env() # Scope issues without this line?

WAGTAILADMIN_BASE_URL = 'https://www.ubyssey.ca/'

ALLOWED_HOSTS = ['localhost', '*']

INTERNAL_IPS = ['127.0.0.1', '0.0.0.0', 'localhost']

# Sessions are used to anonymously keep track of individual site visitors
SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.memcached.PyMemcacheCache',
        'LOCATION': 'cache:11211',
    }
}

STORAGES = {
    'default': {
        'BACKEND': 'storages.backends.gcloud.GoogleCloudStorage',
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}

ADS_TXT_URL = 'https://ubyssey.storage.googleapis.com/ads.txt'

# GCS File Storage - Production Only
MEDIA_URL = 'https://ubyssey.storage.googleapis.com/media/'
MEDIA_ROOT = ''

GS_ACCESS_KEY_ID = env('GS_ACCESS_KEY_ID', default='') or read_file(env('GS_ACCESS_KEY_ID_FILE'))
GS_SECRET_ACCESS_KEY = env('GS_SECRET_ACCESS_KEY', default='') or read_file(env('GS_SECRET_ACCESS_KEY_FILE'))
# GS_CREDENTIALS = service_account.Credentials.from_service_account_file('ubyssey-prd-ee6290e6327f.json')
# GS_CREDENTIALS = env('GOOGLE_APPLICATION_CREDENTIALS')
GS_BUCKET_NAME = 'ubyssey'
GS_LOCATION = 'media'
GS_QUERYSTRING_AUTH = False
GS_FILE_OVERWRITE = False

# Emails - Production Only
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 465
EMAIL_HOST_USER = 'noreply@ubyssey.ca'
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='') or read_file(env('EMAIL_HOST_PASSWORD_FILE'))
EMAIL_USE_SSL = True
UBYSSEY_ADVERTISING_EMAIL = 'advertising@ubyssey.ca'

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440

ADMINS = [
	('Webmaster', 'webmaster@ubyssey.ca'),
]

LOGGING = {
   'version': 1,
   'disable_existing_loggers': False,
   'formatters': {
       'json': {
           '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
           'fmt': '%(asctime)s %(name)s %(levelname)s %(message)s',
           'reserved_attrs': ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename', 'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated', 'thread', 'threadName', 'processName', 'process', 'stack_info'],
       },
   },
   'handlers': {
       'console': {
           'level': 'INFO', 
           'class': 'logging.StreamHandler',
           'stream': sys.stdout,
           'formatter': 'json'
       },
   },
   'loggers': {
       '': {
           'handlers': ['console'],
           'level': 'INFO',  
           'propagate': True,
       },
   },
}
