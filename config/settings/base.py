"""
base.py, default settings, originating from Dispatch module.
Use: place .env file containing app configuration in /ubyssey.ca/

Part of the 12factor app philosophy is to keep config seperate from code. Typically, the environment variables are used for the config.
This code's primary job therefore ought to be retrieving the config from the environment rather than hardcoding in config settings.

Having these imported from Dispatch is too "magical" to be desirable, even if Dispatch is an explict dependency.
Don't Repeat Yourself, yes, but "redundancy" isn't bad if it's accross what are nominally entirely different projects!
More Pythonic is: Explicit rather than implicit.

Environment variable stuff is based on the following document from Google CodeLabs
https://codelabs.developers.google.com/codelabs/cloud-run-django/index.html?index=..%2F..index#5
"""

import os
import sys
import environ
import google_crc32c
from dispatch.apps import DispatchConfig

BASE_DIR = environ.Path(__file__) - 3
DISPATCH_APP_DIR = DispatchConfig.path

env = environ.Env() # will reinitialize later once "earliest" configs have been set

# If we don't have Google app credentials, grab them
if not "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(BASE_DIR, 'client-secret.json')

# Look for the environment variables file in the root directory
# Absolute rather than relative path here, to play nice with Google App Engine
env_file = os.path.join(BASE_DIR, '.env')

# In production we can get .envfrom Google Cloud if we don't have it. This requires authentication.
if os.environ['DJANGO_SETTINGS_MODULE'] == 'config.settings.production' and not os.path.isfile(env_file):
    import google.auth
    from google.cloud import secretmanager as sm
    env_file = os.path.join('/tmp/.env')

    try:
        _, project = google.auth.default()

        if project:
            # See documentation https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
            # (Accessed 2022/05/25)
            client = sm.SecretManagerServiceClient()
            # path = client.secret_version_path(project, "ubyssey_env_configs", "latest")
            name = f"projects/{project}/secrets/ubyssey_env_configs/versions/latest"
            response = client.access_secret_version(request={"name": name})
            crc32c = google_crc32c.Checksum()
            crc32c.update(response.payload.data)
            if response.payload.data_crc32c != int(crc32c.hexdigest(), 16):                
                raise Exception("Data corruption detected when accessing secret from secret manager!")      
            payload = response.payload.data.decode("UTF-8")

            with open(env_file, "w") as f:
                f.write(payload)
        else:
            sys.stderr.write("\nError: Unsuccessful attempt to get a project from google.auth!\n")      
    except Exception as ex:       
        sys.stderr.write("\nError in trying to generate .env file using Google application credentials!\n")
        raise ex

# We now have an .env file.
# An env object from environ library simplifies reading/writing env vars.
# We intialize this object, setting castings and defaults (an advantage of the environ library over simply using the os library)
env = environ.Env(
    #set casting and defaults for config vars which are to be read from environment

    # Development defaults
    # VERSION=(str,'0.0.0'),
    DEBUG=(bool,False),
    ORGANIZATION_NAME = (str, 'Ubyssey'),

    # Temporary
    SPECIAL_MESSAGE_AVAILABLE = (bool,False),
    
    # URL defaults
    STATIC_URL = (str,'/static/'),
    MEDIA_URL = (str,'/media/'),
    ADS_TXT_URL = (str, 'https://ubyssey.storage.googleapis.com/ads.txt'),
    ROOT_URLCONF = (str,'ubyssey.urls'),

    # Time zone defaults
    USE_TZ=(bool,True),
    TIME_ZONE=(str,'Canada/Pacific'),

    # Database defaults:
    SQL_HOST = (str, 'db'),
    SQL_DATABASE= (str, 'ubyssey'),
    SQL_USER = (str, 'root'),
    SQL_PASSWORD = (str, 'ubyssey'),

    # Keys
    SECRET_KEY = (str, 'thisisakey'),
    NOTIFICATION_KEY= (str, 'thisisakeytoo'),

    # delete me
    SECRET_URL = (str, 'somethingsilly')
)

# Read the .env file into os.environ.
environ.Env.read_env(env_file)

# Set Django's configs to the values taken from the .env file (or else to their defaults listed above)
ORGANIZATION_NAME = env('ORGANIZATION_NAME') # Used for registration/invitation
DEBUG = env('DEBUG')

SPECIAL_MESSAGE_AVAILABLE = env('SPECIAL_MESSAGE_AVAILABLE')

USE_TZ = env('USE_TZ')
TIME_ZONE = env('TIME_ZONE')

STATIC_URL = env('STATIC_URL')
MEDIA_URL = env('MEDIA_URL')
ADS_TXT_URL = env('ADS_TXT_URL')
ROOT_URLCONF = env('ROOT_URLCONF')

# Initialize the databases.
# Note it should be possible to parse all this information in a single line:
# DATABASES = {'default': env.db('DATABASE_URL')}
# However, Google Cloud Services does not seem to like providing an easily parsable URL for such purposes
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'HOST': env('SQL_HOST'),
        'NAME': env('SQL_DATABASE'),
        'USER': env('SQL_USER'),
        'PASSWORD': env('SQL_PASSWORD'),
        'PORT': '3306',
    },
}

# TODO: Remove this line after Dispatch is removed as a dependency.
# This silences a reverse accessor clash error between the
# dispatch.User and users.User models.
SILENCED_SYSTEM_CHECKS = [
    'fields.E304' # Reverse accessor clash error
]

# Set secret keys
SECRET_KEY = env('SECRET_KEY')
NOTIFICATION_KEY = env('NOTIFICATION_KEY')

# Application definition
INSTALLED_APPS = [
    # NOTE: Until Dispatch is removed, this app must be loaded first so that
    # the dispatch.User model can be overridden by the `users` app below.
    'dispatch.apps.DispatchConfig',

    # 'whitenoise.runserver_nostatic', # uncomment for testing "production-like" serving of collected static files with DEBUG=False
    'ubyssey', #For some reason using ubyssey.apps.UbysseyConfig breaks static file finding?
    'users',
    'home',
    'archive',
    'authors',
    'article',
    'section',
    'images',
    'videos',
    'ads',
    'specialfeaturelanding',
    'navigation',
    'dashboard',
    'infinitefeed',

    'newsletter.apps.NewsletterConfig',
    'magazine.apps.MagazineConfig',

    'wagtail.contrib.forms',
    'wagtail.contrib.redirects',
    'wagtail.contrib.settings',
    'wagtail.contrib.modeladmin',
    'wagtail.embeds',
    'wagtail.sites',
    'wagtail.users',
    'wagtail.snippets',
    'wagtail.documents',
    'wagtail.images',
    'wagtail.search',
    'wagtail.admin',
    'wagtail.core',
    'wagtail.contrib.routable_page',
    'wagtail.contrib.styleguide',

    'taggit',
    'modelcluster',

    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'rest_framework',
    'rest_framework.authtoken',
    'ubyssey.events',
    'django_user_agents',
    'django.contrib.admin',
    'django_extensions',
    
    'django.contrib.sites',
    'dbtemplates',
    'wagtailmodelchooser',
    'wagtailmenus',
    'wagtailcache',
    'wagtail_color_panel',
]

if DEBUG:
	INSTALLED_APPS += [
		'debug_toolbar'
	]

# Replace default user model
AUTH_USER_MODEL = 'users.User'

API_URL = '/api/'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 9,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Templates
TEMPLATES = [
    {
        'NAME': 'app_dirs',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': False,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'wagtail.contrib.settings.context_processors.settings',
                'wagtailmenus.context_processors.wagtailmenus',
            ],
            'loaders': [
                'django.template.loaders.filesystem.Loader',
                'django.template.loaders.app_directories.Loader',
                'dbtemplates.loader.Loader',
            ],
        },
    },
    {
        'NAME': 'dispatch',
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
			DISPATCH_APP_DIR('templates')
        ],
    },
]

TEMPLATES[0]['OPTIONS']['context_processors'].append("config.context_processors.get_light_mode")

# REST framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.TokenAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'UNICODE_JSON': True,
    'PAGE_SIZE': 10,
    'DATETIME_INPUT_FORMATS': ['iso-8601']
}

STATICFILES_DIRS = []

# Set the middleware
MIDDLEWARE = [
    'wagtailcache.cache.UpdateCacheMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.gzip.GZipMiddleware',
]

if DEBUG:
    MIDDLEWARE += [
        'debug_toolbar.middleware.DebugToolbarMiddleware',
    ]

MIDDLEWARE += [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'wagtail.contrib.redirects.middleware.RedirectMiddleware',
    'wagtailcache.cache.UpdateCacheMiddleware',
]

GS_LOCATION = None
GS_STORAGE_BUCKET_NAME = None # See documentation https://django-storages.readthedocs.io/en/latest/backends/gcloud.html
GS_USE_SIGNED_URLS = False

PHONENUMBER_DB_FORMAT = 'NATIONAL'
PHONENUMBER_DEFAULT_REGION = 'CA'

PASSWORD_RESET_TIMEOUT_DAYS = 1

# STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
WHITENOISE_KEEP_ONLY_HASHED_FILES = True

WAGTAIL_SITE_NAME = 'The Ubyssey'

WAGTAILIMAGES_IMAGE_MODEL = 'images.UbysseyImage'

WAGTAILIMAGES_FORMAT_CONVERSIONS = {
    'png': 'webp',
    'jpeg': 'webp',
    'bmp': 'webp',
    'webp': 'webp',
}

# wagtailmenus settings
WAGTAILMENUS_ACTIVE_CLASS = 'current' # used for css in e.g. navigation/header.html
WAGTAILMENUS_ACTIVE_ANCESTOR_CLASS = 'current'

# Model defaults
DEFAULT_AUTO_FIELD='django.db.models.AutoField'

SITE_ID = 1