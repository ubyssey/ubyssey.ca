from django.db import models

# Relates Wagtail Page to YJS binary document
class ManuscriptCollaboration(models.Model):
    page = models.OneToOneField(
        "wagtailcore.Page",
        on_delete=models.CASCADE,
        # Disable reverse reference
        related_name="+",
    )
    document = models.BinaryField(default=bytes, blank=True)
    autosave_revision = models.ForeignKey(
        "wagtailcore.Revision",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_at = models.DateTimeField(auto_now=True)
