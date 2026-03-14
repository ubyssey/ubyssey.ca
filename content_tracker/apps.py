from django.apps import AppConfig


class ContentTrackerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'content_tracker'

    def ready(self):
        from content_tracker import mail  # noqa: F401 — registers signal handlers
