import asyncio
from channels.db import database_sync_to_async
from django.db import transaction

# pycrdt provides python bindings to rust port of YJS which is the library used here for collaboration
from pycrdt import Doc
from pycrdt.websocket.django_channels_consumer import (
    YMessageType,
    YjsConsumer,
    handle_sync_message,
)

from wagtail.models import Page
from .models import ManuscriptCollaboration

# Delay, we should do some testing with more users at once
PERSISTENCE_BATCH_DELAY_SECONDS = 0.25

# Used in collabaration.js, code sent which tells clients to reload vs applying local YJS state (maybe a bad move)
RESTORE_CLOSE_CODE = 4410


# This channel is used to tell all connected editors that a restore happened
def restore_group_name(page_id):
    return f"stove_yjs_restore_{page_id}"


# Sync Y document with manuscript page
class ManuscriptYjsConsumer(YjsConsumer):

    def __init__(self):
        super().__init__()
        self.page_id = None
        self._persist_updates = True
        self._pending_updates = []
        self._persistence_task = None

    # Figure out proper authentification here, maybe use assignment manager assignments?
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=4401)
            return

        self.page_id = int(self.scope["url_route"]["kwargs"]["page_id"])
        if not await self._page_exists():
            await self.close(code=4404)
            return

        await super().connect()
        await self.channel_layer.group_add(
            restore_group_name(self.page_id),
            self.channel_name,
        )

    async def disconnect(self, code):
        if self.page_id is not None:
            await self.channel_layer.group_discard(
                restore_group_name(self.page_id),
                self.channel_name,
            )
        if self.room_name:
            await super().disconnect(code)
        # Waits for last edits here before saving
        if self._persistence_task:
            await asyncio.gather(self._persistence_task, return_exceptions=True)

    def make_room_name(self):
        return f"stove_yjs_{self.page_id}"

    async def manuscript_restored(self, event):
        await self.close(code=RESTORE_CLOSE_CODE)

    async def make_ydoc(self):
        ydoc = Doc()
        saved_document = await self._load_document()
        if saved_document:
            ydoc.apply_update(saved_document)
        ydoc.observe(self._document_updated)
        return ydoc

    # Applies updates received through channel in handle_sync_message
    async def send_message(self, message_wrapper):
        message = message_wrapper["message"]

        if message and message[0] == YMessageType.SYNC:
            self._persist_updates = False
            try:
                handle_sync_message(message[1:], self.ydoc)
            finally:
                self._persist_updates = True

        await super().send_message(message_wrapper)

    # Helpers below
    def _document_updated(self, event):
        if not self._persist_updates:
            return
        self._pending_updates.append(bytes(event.update))
        if self._persistence_task is None:
            self._persistence_task = asyncio.create_task(
                self._persist_update_batches()
            )

    async def _persist_update_batches(self):
        try:
            while self._pending_updates:
                await asyncio.sleep(PERSISTENCE_BATCH_DELAY_SECONDS)
                updates = self._pending_updates
                self._pending_updates = []
                await self._merge_document(updates)
        finally:
            self._persistence_task = None

    @database_sync_to_async
    def _page_exists(self):
        return Page.objects.filter(pk=self.page_id).exists()

    @database_sync_to_async
    def _load_document(self):
        document = (
            ManuscriptCollaboration.objects.filter(page_id=self.page_id)
            .values_list("document", flat=True)
            .first()
        )
        return bytes(document) if document else b""

    @database_sync_to_async
    def _merge_document(self, updates):
        with transaction.atomic():
            Page.objects.select_for_update().only("pk").get(pk=self.page_id)
            session, _ = ManuscriptCollaboration.objects.get_or_create(
                page_id=self.page_id,
            )
            ydoc = Doc()
            if session.document:
                ydoc.apply_update(bytes(session.document))
            for update in updates:
                ydoc.apply_update(update)
            session.document = ydoc.get_update()
            session.save(update_fields=["document", "updated_at"])
