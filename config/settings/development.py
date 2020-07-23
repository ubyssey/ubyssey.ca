# development.py, settings file
# see https://djangostars.com/blog/configuring-django-settings-best-practices/

# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *

BASE_URL = 'http://localhost:8000/'

ALLOWED_HOSTS = ['localhost', '*']

INSTALLED_APPS += ['ubyssey.events', 'django_user_agents', ]

INTERNAL_IPS = ['127.0.0.1', 'localhost']

MIDDLEWARE = (
    # other middlewares...
    'django_user_agents.middleware.UserAgentMiddleware',
)


# TODO: Figure out why this is development only!
TEMPLATES += [
 {
        'NAME': 'ubyssey',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
			PROJECT_DIR('ubyssey/templates/')
        ],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    }
]

STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
STATIC_URL = '/static/'
STATIC_ROOT = '/static/'

# TODO: Figure out why this is development only!
GCS_CREDENTIALS_FILE = '../gcs-local.json'

# TODO: Figure out why this is development only!
MEDIA_ROOT = PROJECT_DIR('media')

# TODO: Figure out why this is NOT in deployment!
# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
