# development.py, settings file
# see https://djangostars.com/blog/configuring-django-settings-best-practices/

# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *

BASE_URL = 'http://localhost:8000/'

ALLOWED_HOSTS = ['localhost', '*']

INTERNAL_IPS = ['127.0.0.1', '0.0.0.0', 'localhost']

# Easily manipulable file cache for proof of concept for front page etc.
CACHES = {
    "default": {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
        # "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        # "LOCATION": "/workspaces/ubyssey.ca/cache/",
    }
}

MIDDLEWARE += [
    # other middlewares...
    'django_user_agents.middleware.UserAgentMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware",
]

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
MEDIA_URL = '/media/'

GCS_CREDENTIALS_FILE = '../gcs-local.json'

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
