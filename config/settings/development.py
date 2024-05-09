# development.py, settings file
# see https://djangostars.com/blog/configuring-django-settings-best-practices/

# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *

WAGTAILADMIN_BASE_URL = 'http://localhost:8000/'

ALLOWED_HOSTS = ['localhost', '*']

INTERNAL_IPS = ['127.0.0.1', '0.0.0.0', 'localhost']

# The dummy cache does not cache any values. We use this in development
# so that the website always updates after code changes.
CACHES = {
    "default": {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    },
    "renditions": {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

TEMPLATES += [
{
        'NAME': 'ubyssey',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
			BASE_DIR('ubyssey/templates/')
        ],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    }
]

# STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

GCS_CREDENTIALS_FILE = '../gcs-local.json'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

GCS_CREDENTIALS_FILE = '../gcs-local.json'

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
