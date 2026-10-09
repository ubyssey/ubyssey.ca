# Detects whether Stove editor open for a page

from datetime import timedelta
from uuid import UUID

from django.utils import timezone
from django.db import transaction
from wagtail.models import Page

from stove.models import PageCollaboration, PageCollaborationPresence


PRESENCE_REFRESH_SECONDS = 60
PRESENCE_TIMEOUT_SECONDS = 180


def claim_page_presence(page_id, presence_id):
    now = timezone.now()
    with transaction.atomic():
        Page.objects.select_for_update().get(pk=page_id)
        if not PageCollaboration.objects.filter(page_id=page_id).exists():
            return False

        PageCollaborationPresence.objects.filter(expires_at__lt=now).delete()
        PageCollaborationPresence.objects.update_or_create(
            presence_id=presence_id,
            defaults={
                "page_id": page_id,
                "expires_at": now + timedelta(seconds=PRESENCE_TIMEOUT_SECONDS),
            },
        )
        return True


def refresh_page_presence(page_id, presence_id):
    return bool(PageCollaborationPresence.objects.filter(page_id=page_id, presence_id=presence_id).update(
        expires_at=timezone.now() + timedelta(seconds=PRESENCE_TIMEOUT_SECONDS),
    ))


def release_page_presence(presence_id):
    PageCollaborationPresence.objects.filter(presence_id=presence_id).delete()


def page_is_being_edited_in_stove(page_id):
    return PageCollaborationPresence.objects.filter(page_id=page_id, expires_at__gte=timezone.now()).exists()
