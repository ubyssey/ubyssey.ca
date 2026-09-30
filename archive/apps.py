from django.apps import AppConfig


class ArchiveConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'archive'

    def ready(self):
        import archive.signals  # noqa: F401

        return super().ready()
