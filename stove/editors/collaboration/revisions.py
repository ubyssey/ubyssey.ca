from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from wagtail.models import Page

from stove.models import PageCollaboration

from stove.editors.collaboration.consumers import page_restore_group_name
from stove.editors.manuscript.submission import process_submitted_page


# seconds between autosaves to revision (not sure what a good value should be)
AUTOSAVE_REVISION_WINDOW_SECONDS = 60*15

# Saves editor data as a draft, combining autosave revisions within the window into a single revision
def autosave_manuscript_revision(page_id, data, user):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        page = page_record.specific.get_latest_revision_as_object()
        process_submitted_page(page, data)

        session, _ = PageCollaboration.objects.get_or_create(page=page_record)
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


def save_page_revision(page, action, user):
    errors = {}
    siblings = page.get_siblings().exclude(id=page.id)
    if siblings.filter(slug=page.slug).exists():
        errors["slug"] = ["Slug must be unique among siblings."]
        return page, None, errors

    try:
        page.full_clean()
    except ValidationError as error:
        for field, field_errors in error.message_dict.items():
            errors.setdefault(field, []).extend(field_errors)

    if errors:
        return page, None, errors

    try:
        revision = page.save_revision(user=user)
        if action == "publish":
            revision.publish(user=user)
            page = Page.objects.get(id=page.id).specific
    except Exception:
        errors["__all__"] = ["Failed to update page."]
        return page, None, errors

    return page, revision, errors


def restore_page_revision(page, revision, submitted_data, user):
    restored_page = revision.as_object()
    current_data = submitted_data.copy()
    current_data.pop("revision", None)
    current_page = page.get_latest_revision_as_object()
    process_submitted_page(current_page, current_data)
    current_page.save_revision(user=user)

    saved_revision = restored_page.save_revision(user=user)

    PageCollaboration.objects.filter(page_id=page.id).delete()
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            page_restore_group_name(page.id),
            {"type": "page.restored"},
        )

    return saved_revision
