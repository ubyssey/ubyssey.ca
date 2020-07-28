# deployment.py, Django settings file

# Two Scoops of Django, p. 47: "For the singular case of Django setting modules we want to override all the namespace"
# Therefore the below "import *" is correct
from .base import *

SECRET_KEY = 'TEMP-KEY'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS += ['ubyssey.events',]

WHITENOISE_KEEP_ONLY_HASHED_FILES = True
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'gcs/static')