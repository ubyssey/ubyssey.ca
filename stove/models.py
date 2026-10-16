from django.db import models


# Relates Wagtail Page to YJS binary document
class PageCollaboration(models.Model):
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


# For each browser currently in a Stove editor page
class PageCollaborationPresence(models.Model):
    page = models.ForeignKey("wagtailcore.Page", on_delete=models.CASCADE)
    # UUID generated for each browser session, multiple rows if multiple on same page
    presence_id = models.UUIDField(unique=True)
    # Expires after a few mins of inactivity, so crashes and whatnot clear the db
    expires_at = models.DateTimeField(db_index=True)
