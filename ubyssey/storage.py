from django.contrib.staticfiles.storage import ManifestFilesMixin

from storages.backends.gcloud import GoogleCloudStorage

# TODO: Replace or remove these classes after upgrading to Django > 4.2.
#
# These custom wrapper classes are a workaround to allow
# static files and media files to be stored in different
# subfolders (i.e. locations) in the same GCS bucket.
#
# In Django 4.2 and above, it is possible to configure
# static file storage separately from default storage.
#
# Ref: https://django-storages.readthedocs.io/en/latest/backends/gcloud.html#configuration-settings

class GCSStaticFilesStorage(ManifestFilesMixin, GoogleCloudStorage):
    """
    This class wraps the GoogleCloudStorage class to add manifest support
    and define a unique storage location (i.e. 'static').

    Ref: https://docs.djangoproject.com/en/5.0/ref/contrib/staticfiles/#manifeststaticfilesstorage
    """

    # Store all static files in the 'static' directory
    LOCATION = 'static'

    def __init__(self):
        super().__init__(location=GCSStaticFilesStorage.LOCATION)

class GCSMediaStorage(GoogleCloudStorage):
    """
    This class wraps the GoogleCloudStorage class to define a
    unique storage location (i.e. 'media').
    """

    # Store all files in the 'media' directory
    LOCATION = 'media'

    def __init__(self):
        super().__init__(location=GCSMediaStorage.LOCATION)
