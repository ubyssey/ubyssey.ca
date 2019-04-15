import os

from dispatch.default_settings import *

BASE_URL = 'http://localhost:8000/'

SECRET_KEY = '&t7b#38ncrab5lmpe#pe#41coa-8ctwuy@tm0!x8*n_r38x_m*'
NOTIFICATION_KEY = "Fill with key"

VERSION = '1.4.130'

ALLOWED_HOSTS = ['localhost', '*']

INSTALLED_APPS += ['ubyssey.events', 'ubyssey.notifications', 'django_user_agents',]

INTERNAL_IPS = ['127.0.0.1', 'localhost']

ROOT_URLCONF = 'ubyssey.urls'

MIDDLEWARE = (
    # other middlewares...
    'django_user_agents.middleware.UserAgentMiddleware',
)

DEBUG = True
USE_TZ = True

TIME_ZONE = 'America/Vancouver'

################ LOCAL MYSQL ##################
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': 'ubyssey',
#         'USER': 'root',
#         'PASSWORD': 'ubyssey',
#         'HOST': '127.0.0.1',
#         'PORT': '3306',
#     },
# }

############## DOCKER MYSQL ###################
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'ubyssey',
        'USER': 'root',
        'PASSWORD': 'ubyssey',
        'HOST': 'db',
        'PORT': '3306',
    },
}
###############################################

TEMPLATES += [
 {
        'NAME': 'ubyssey',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(os.path.dirname(__file__), 'templates'),
        ],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    }
]

STATICFILES_DIRS += (
    os.path.join(os.path.dirname(__file__), 'static/dist'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), 'service-workers')
)

STATIC_URL = '/static/'
MEDIA_URL = '/media/'

GCS_CREDENTIALS_FILE = '../gcs-local.json'

SERVICE_WORKER_URL = '/service-worker.js'

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'media')

# Use in-memory file handler on Google App Engine
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler',]
FILE_UPLOAD_MAX_MEMORY_SIZE = 25621440
