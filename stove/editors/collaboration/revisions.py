import base64
import binascii
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from wagtail.models import Page
from pycrdt import Doc

from stove.models import PageCollaboration

from stove.editors.collaboration.consumers import page_restore_group_name
from stove.editors.collaboration.persistence import send_page_update
from stove.editors.manuscript.submission import process_editor_forms


# seconds between autosaves to revision (not sure what a good value should be)
AUTOSAVE_REVISION_WINDOW_SECONDS = 60*15
EMPTY_YJS_UPDATE = b"\x00\x00"
STALE_AUTOSAVE = object()


def _decode_collaboration_value(data, field_name):
    value = data.get(field_name)
    if not value:
        return None
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        return None


def _merge_collaboration_snapshot(session, data):
    state_vector = _decode_collaboration_value(data, "collaboration_state_vector")
    submitted_update = _decode_collaboration_value(data, "collaboration_update")
    if state_vector is None and submitted_update is None:
        return False

    document = Doc()
    if session.document:
        document.apply_update(bytes(session.document))

    is_stale = False
    if state_vector is not None:
        missing_update = document.get_update(state_vector)
        if missing_update != EMPTY_YJS_UPDATE:
            if submitted_update is None:
                is_stale = True
            else:
                submitted_document = Doc()
                submitted_document.apply_update(submitted_update)
                submitted_state = submitted_document.get_update()
                submitted_document.apply_update(missing_update)
                is_stale = submitted_document.get_update() != submitted_state

    if submitted_update is not None:
        previous_state = document.get_state()
        document.apply_update(submitted_update)
        recovered_update = document.get_update(previous_state)
        merged_document = document.get_update()
        if merged_document != bytes(session.document):
            session.document = merged_document
            session.save(update_fields=["document", "updated_at"])
            if recovered_update != EMPTY_YJS_UPDATE:
                transaction.on_commit(
                    lambda: send_page_update(session.page_id, recovered_update)
                )

    return is_stale


# Saves editor data as a draft, combining autosave revisions within the window into a single revision
def autosave_page_revision(page_id, data, user):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        session, _ = PageCollaboration.objects.get_or_create(page=page_record)
        session = PageCollaboration.objects.select_for_update().get(pk=session.pk)

        if _merge_collaboration_snapshot(session, data):
            return STALE_AUTOSAVE

        page = page_record.specific.get_latest_revision_as_object()
        process_editor_forms(page, data)

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


# Merge caller's state then create revision
def save_manual_page_revision(page_id, data, user):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        session, _ = PageCollaboration.objects.get_or_create(page=page_record)
        session = PageCollaboration.objects.select_for_update().get(pk=session.pk)

        if _merge_collaboration_snapshot(session, data):
            return STALE_AUTOSAVE, {"__all__": ["The document is still syncing. Please try saving again."]}

        page = page_record.specific.get_latest_revision_as_object()
        editor_errors, _, _, _ = process_editor_forms(page, data)
        if editor_errors:
            return None, editor_errors

        _, revision, save_errors = save_page_revision(page, "draft", user)
        return revision, save_errors


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
    process_editor_forms(current_page, current_data)
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
