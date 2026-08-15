from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from wagtail.models import Page

from stove.models import ManuscriptCollaboration

from stove.editors.manuscript.serialization import apply_editor_post


# seconds between autosaves to revision (not sure what a good value should be)
AUTOSAVE_REVISION_WINDOW_SECONDS = 60*15

# Saves editor data as a draft, combining autosave revisions within the window into a single revision
def autosave_manuscript_revision(page_id, data, user):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        page = page_record.specific.get_latest_revision_as_object()
        apply_editor_post(page, data)

        session, _ = ManuscriptCollaboration.objects.get_or_create(page=page_record)
        previous_autosave = session.autosave_revision
        latest_revision = page.get_latest_revision()

        replace_previous = (
            previous_autosave is not None
            and latest_revision is not None
            and previous_autosave.pk == latest_revision.pk
            and previous_autosave.created_at >= timezone.now() - timedelta(seconds=AUTOSAVE_REVISION_WINDOW_SECONDS)
        )

        # Only overwrite previous if same user, otherwise create a new revision and deletes old
        # This is because of the save_revision function below which checks if user is the same
        overwrite_previous = (
            replace_previous
            and previous_autosave.user_id == getattr(user, "pk", None)
        )

        try:
            revision = page.save_revision(
                user=user,
                overwrite_revision=previous_autosave if overwrite_previous else None,
            )
        except ValidationError:
            return None

        session.autosave_revision = revision
        session.save(update_fields=["autosave_revision"])

        if replace_previous and not overwrite_previous:
            previous_autosave.delete()

        return revision
