import base64
import binascii
import logging
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from wagtail.models import Page
from wagtail.log_actions import LogContext
from pycrdt import Doc

from stove.models import PageCollaboration

from stove.editors.collaboration.consumers import page_restore_group_name
from stove.editors.collaboration.persistence import send_page_update
from stove.editors.manuscript.submission import process_editor_forms
from stove.editors.collaboration.serialization import yjs_document_to_wagtail_form_data


# seconds between autosaves to revision (not sure what a good value should be)
AUTOSAVE_REVISION_WINDOW_SECONDS = 60*15
EMPTY_YJS_UPDATE = b"\x00\x00"

STOVE_AUTOSAVE_ACTION = "stove.autosave"
STOVE_SAVE_ACTION = "stove.save"
STOVE_SAVE_BEFORE_RESTORE_ACTION = "stove.restore.snapshot"
STOVE_RESTORE_ACTION = "stove.restore"

logger = logging.getLogger(__name__)


def _decode_collaboration_value(data, field_name):
    value = data.get(field_name)
    if not value:
        return None
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        return None


def _merge_collaboration_snapshot(session, data, user):
    collaboration_id = data.get("collaboration_id")
    if collaboration_id != str(session.pk):
        raise ValidationError("The document has changed. Reload the editor.")
    submitted_update = _decode_collaboration_value(data, "collaboration_update")
    if submitted_update is None:
        return

    document = Doc()
    if session.document:
        document.apply_update(bytes(session.document))

    previous_state = document.get_state()
    document.apply_update(submitted_update)
    recovered_update = document.get_update(previous_state)
    merged_document = document.get_update()
    if merged_document != bytes(session.document):
        session.document = merged_document
        session.revision_pending = True
        session.last_edited_by = user
        session.save(update_fields=["document", "updated_at", "revision_pending", "last_edited_by"])
        if recovered_update != EMPTY_YJS_UPDATE:
            transaction.on_commit(
                lambda: send_page_update(session.page_id, session.pk, recovered_update)
            )

    submitted_document = Doc()
    submitted_document.apply_update(submitted_update)
    submitted_state = submitted_document.get_update()
    missing_update = document.get_update(submitted_document.get_state())
    submitted_document.apply_update(missing_update)
    if submitted_document.get_update() != submitted_state:
        transaction.on_commit(
            lambda: send_page_update(session.page_id, session.pk, missing_update)
        )


def get_collaboration_form_data(page, submitted_data, user):
    with transaction.atomic():
        Page.objects.select_for_update().only("pk").get(pk=page.pk)
        session = PageCollaboration.objects.select_for_update().filter(page_id=page.pk).first()
        if session is None or not session.document:
            raise ValidationError("The collaborative document is unavailable. Reload the editor.")
        _merge_collaboration_snapshot(session, submitted_data, user)
        return yjs_document_to_wagtail_form_data(page, session.document)


# Saves editor data as a draft, combining autosave revisions within the window into a single revision
def autosave_page_revision(page_id, user=None, collaboration_id=None):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        sessions = PageCollaboration.objects.select_for_update().filter(page_id=page_id)
        if collaboration_id is not None:
            sessions = sessions.filter(pk=collaboration_id)
        session = sessions.first()
        if session is None or not session.document:
            return None
        if not session.revision_pending:
            return page_record.get_latest_revision()

        user = user or session.last_edited_by
        page = page_record.specific.get_latest_revision_as_object()
        data = yjs_document_to_wagtail_form_data(page, session.document)
        editor_errors, _, _, _ = process_editor_forms(page, data)
        if editor_errors:
            return None

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
            with LogContext(user=user):
                revision = page.save_revision(
                    user=user,
                    log_action=STOVE_AUTOSAVE_ACTION,
                    overwrite_revision=previous_autosave if overwrite_previous else None,
                )
        except ValidationError:
            return None

        session.autosave_revision = revision
        session.revision_pending = False
        session.save(update_fields=["autosave_revision", "revision_pending"])

        if replace_previous and not overwrite_previous:
            previous_autosave.delete()

        return revision


# Retry autosave for all with pending revisions
def autosave_pending_page_revisions():
    sessions = PageCollaboration.objects.filter(revision_pending=True).values_list("page_id", "pk")
    for page_id, collaboration_id in sessions.iterator():
        try:
            if autosave_page_revision(page_id, collaboration_id=collaboration_id) is None:
                logger.warning("Could not autosave Stove page %s", page_id)
        except Exception:
            logger.exception("Could not autosave Stove page %s", page_id)


# Merge caller's state then create revision
def save_manual_page_revision(page_id, data, user, action="draft"):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page_id)
        session = PageCollaboration.objects.select_for_update().filter(page_id=page_id).first()
        if session is None or not session.document:
            return None, {"__all__": ["Please reload the editor."]}
        try:
            _merge_collaboration_snapshot(session, data, user)
        except ValidationError as error:
            return None, {"__all__": error.messages}

        page = page_record.specific.get_latest_revision_as_object()
        editor_data = yjs_document_to_wagtail_form_data(page, session.document)
        editor_errors, _, _, _ = process_editor_forms(page, editor_data)
        if editor_errors:
            return None, editor_errors

        _, revision, save_errors = save_page_revision(page, action, user)
        if revision is not None:
            session.revision_pending = False
            session.save(update_fields=["revision_pending"])

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
        revision = page.save_revision(user=user, log_action=STOVE_SAVE_ACTION)
        if action == "publish":
            revision.publish(user=user)
            page = Page.objects.get(id=page.id).specific
    except Exception:
        errors["__all__"] = ["Failed to update page."]
        return page, None, errors

    return page, revision, errors


def restore_page_revision(page, revision, submitted_data, user):
    with transaction.atomic():
        page_record = Page.objects.select_for_update().get(pk=page.pk)
        current_page = page_record.specific.get_latest_revision_as_object()
        current_data = get_collaboration_form_data(current_page, submitted_data, user)

        errors, _, _, _ = process_editor_forms(current_page, current_data)
        if errors:
            raise ValidationError("The current document could not be saved before restoring.")

        current_page.save_revision(user=user, log_action=STOVE_SAVE_BEFORE_RESTORE_ACTION)

        restored_page = revision.as_object()
        saved_revision = restored_page.save_revision(user=user, log_action=STOVE_RESTORE_ACTION)

        PageCollaboration.objects.filter(page_id=page.id).delete()
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            transaction.on_commit(lambda: async_to_sync(channel_layer.group_send)(
                page_restore_group_name(page.id), {"type": "page.restored"},
            ))

        return saved_revision
