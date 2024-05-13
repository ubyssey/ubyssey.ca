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

BASE_DIR = environ.Path(__file__) - 3

env = environ.Env() # will reinitialize later once "earliest" configs have been set

# If we don't have Google app credentials, grab them
if not "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(BASE_DIR, 'client-secret.json')

# Look for the environment variables file in the root directory
# Absolute rather than relative path here, to play nice with Google App Engine
env_file = os.path.join(BASE_DIR, 'tmp/.env')

# In production we can get .envfrom Google Cloud if we don't have it. This requires authentication.
if os.environ['DJANGO_SETTINGS_MODULE'] == 'config.settings.staging' and not os.path.isfile(env_file):
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

    # SQL defaults
    SQL_HOST = (str, 'db'),
    SQL_DATABASE = (str, 'ubyssey'),
    SQL_USER = (str, 'root'),
    SQL_PASSWORD = (str, 'ubyssey'),

    # Redis defaults
    REDIS_HOST = (str, '127.0.0.1'),
    REDIS_PORT = (str, '6379'),

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

REDIS_HOST = env('REDIS_HOST')
REDIS_PORT = env('REDIS_PORT')

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

# Set secret keys
SECRET_KEY = env('SECRET_KEY')
NOTIFICATION_KEY = env('NOTIFICATION_KEY')

# Application definition
INSTALLED_APPS = [

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
    'wagtail.embeds',
    'wagtail.sites',
    'wagtail.users',
    'wagtail.snippets',
    'wagtail.documents',
    'wagtail.images',
    'wagtail.search',
    'wagtail.admin',
    'wagtail',
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
    'django.contrib.sites',

    'rest_framework',
    'rest_framework.authtoken',
    'django_user_agents',
    'django.contrib.admin',
    'django_extensions',
    
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
                'config.context_processors.get_light_mode',
            ],
            'loaders': [
                (
                    'django.template.loaders.cached.Loader',
                    [
                        'django.template.loaders.filesystem.Loader',
                        'django.template.loaders.app_directories.Loader',
                        'dbtemplates.loader.Loader',
                    ],
                ),
            ],
        },
    }
]

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
    # UpdateCacheMiddleware must come first.
    # Ref: https://github.com/coderedcorp/wagtail-cache/blob/main/docs/getting_started/install.rst#1-install
    'wagtailcache.cache.UpdateCacheMiddleware',

    'canonical_domain.middleware.CanonicalDomainMiddleware',
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

    # FetchFromCacheMiddleware must come last.
    # Ref: https://github.com/coderedcorp/wagtail-cache/blob/main/docs/getting_started/install.rst#1-install
    'wagtailcache.cache.FetchFromCacheMiddleware',
]

# Clear these URLs from the cache each time an article or page is published.
#
# Note: this is a custom setting used in ubyssey/wagtail_hooks.py.
#
CACHE_CLEAR_ON_PUBLISH = [
    '/$',           # Home page
    '/archive/$',   # Archive page
    '/infinitefeed' # Endpoint used to populate infinite scrolling on section pages
]

GS_LOCATION = None
GS_STORAGE_BUCKET_NAME = None # See documentation https://django-storages.readthedocs.io/en/latest/backends/gcloud.html

PHONENUMBER_DB_FORMAT = 'NATIONAL'
PHONENUMBER_DEFAULT_REGION = 'CA'

PASSWORD_RESET_TIMEOUT = 86400

# STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
WHITENOISE_KEEP_ONLY_HASHED_FILES = True

WAGTAIL_SITE_NAME = 'The Ubyssey'

WAGTAILIMAGES_IMAGE_MODEL = 'images.UbysseyImage'


# wagtailmenus settings
WAGTAILMENUS_ACTIVE_CLASS = 'current' # used for css in e.g. navigation/header.html
WAGTAILMENUS_ACTIVE_ANCESTOR_CLASS = 'current'

# wagtail search settings
WAGTAILSEARCH_BACKENDS = {
    'default': {
        'BACKEND': 'wagtail.search.backends.database',
    }
}

# Model defaults
DEFAULT_AUTO_FIELD='django.db.models.AutoField'

SITE_ID = 1