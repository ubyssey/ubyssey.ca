from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone
from wagtail.admin.models import EditingSession
from wagtail.models import Page, get_default_page_content_type

from stove.models import PageCollaboration, PageCollaborationPresence
from stove.editors.collaboration.presence import page_is_being_edited_in_stove


WAGTAIL_EDITING_CLOSE_CODE = 4411

def page_is_being_edited_in_wagtail(page_id):
    return EditingSession.objects.filter(
        content_type=get_default_page_content_type(),
        object_id=str(page_id),
        last_seen_at__gte=timezone.now() - EditingSession.IDLE_TIMEOUT,
    ).exists()


# only_if_stove_is_inactive is false for "View in Wagtail" button, which forces the handoff even if Stove is active
# it is true when directly accessing a wagtail page
def hand_page_to_wagtail(page_id, only_if_stove_is_inactive=False):
    with transaction.atomic():
        Page.objects.select_for_update().get(pk=page_id)

        if only_if_stove_is_inactive and page_is_being_edited_in_stove(page_id):
            return False

        PageCollaboration.objects.filter(page_id=page_id).delete()
        PageCollaborationPresence.objects.filter(page_id=page_id).delete()
        transaction.on_commit(lambda: _close_stove_clients(page_id))
    return True


def _close_stove_clients(page_id):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"stove_yjs_{page_id}",
        {"type": "page.wagtail_edit_started"},
    )
