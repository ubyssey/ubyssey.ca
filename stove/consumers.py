import asyncio
from channels.db import database_sync_to_async
from django.db import transaction

# pycrdt provides python bindings to rust port of YJS which is the library used here for collaboration
from pycrdt import Doc, YMessageType, YSyncMessageType, read_message
from pycrdt.websocket.django_channels_consumer import (
    YjsConsumer,
    handle_sync_message,
)

from wagtail.models import Page
from .models import ManuscriptCollaboration

# Formerly was 0.25
PERSISTENCE_BATCH_DELAY_SECONDS = 0.1

# Used in collabaration.js, code sent which tells clients to reload vs applying local YJS state (maybe a bad move)
RESTORE_CLOSE_CODE = 4410

# Sent after changes are merged in
PERSISTENCE_ACK_MESSAGE = 4


# This channel is used to tell all connected editors that a restore happened
def restore_group_name(page_id):
    return f"stove_yjs_restore_{page_id}"


# Sync Y document with manuscript page
class ManuscriptYjsConsumer(YjsConsumer):

    def __init__(self):
        super().__init__()
        self.page_id = None
        self._pending_updates = []
        self._persistence_task = None
        # Manuscript Collaboration object PK
        self.collaboration_id = None

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
        if self._pending_updates:
            updates = self._pending_updates
            self._pending_updates = []
            await self._merge_document(updates)
            await self.group_send_message(bytes([PERSISTENCE_ACK_MESSAGE]))

    def make_room_name(self):
        return f"stove_yjs_{self.page_id}"

    async def manuscript_restored(self, event):
        await self.close(code=RESTORE_CLOSE_CODE)

    async def make_ydoc(self):
        ydoc = Doc()
        self.collaboration_id, saved_document = await self._load_document()
        if saved_document:
            ydoc.apply_update(saved_document)
        return ydoc

    # Sends live changes immediately, then persists the recieved update
    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is None:
            return

        await self.group_send_message(bytes_data)
        if bytes_data[0] != YMessageType.SYNC:
            return

        reply = handle_sync_message(bytes_data[1:], self.ydoc)
        sync_type = YSyncMessageType(bytes_data[1])
        if sync_type in (
            YSyncMessageType.SYNC_STEP2,
            YSyncMessageType.SYNC_UPDATE,
        ):
            update = read_message(bytes_data[2:])
            if update != b"\x00\x00":
                self._pending_updates.append(update)
                if self._persistence_task is None:
                    self._persistence_task = asyncio.create_task(
                        self._persist_update_batches()
                    )

        if reply is not None:
            await self._websocket_shim.send(reply)

    # Applies updates received through channel in handle_sync_message
    async def send_message(self, message_wrapper):
        message = message_wrapper["message"]

        if message and message[0] == YMessageType.SYNC:
            handle_sync_message(message[1:], self.ydoc)

        await super().send_message(message_wrapper)

    async def _persist_update_batches(self):
        try:
            while self._pending_updates:
                await asyncio.sleep(PERSISTENCE_BATCH_DELAY_SECONDS)
                batch_size = len(self._pending_updates)
                updates = self._pending_updates[:batch_size]
                await self._merge_document(updates)
                del self._pending_updates[:batch_size]
                await self.group_send_message(bytes([PERSISTENCE_ACK_MESSAGE]))
        finally:
            self._persistence_task = None

    @database_sync_to_async
    def _page_exists(self):
        return Page.objects.filter(pk=self.page_id).exists()

    @database_sync_to_async
    def _load_document(self):
        session = (
            ManuscriptCollaboration.objects.filter(page_id=self.page_id)
            .values_list("id", "document")
            .first()
        )
        if session is None:
            return None, b""
        collaboration_id, document = session
        return collaboration_id, bytes(document) if document else b""

    @database_sync_to_async
    def _merge_document(self, updates):
        with transaction.atomic():
            Page.objects.select_for_update().only("pk").get(pk=self.page_id)
            session = ManuscriptCollaboration.objects.select_for_update().filter(
                pk=self.collaboration_id,
                page_id=self.page_id,
            ).first()
            if session is None:
                return
            ydoc = Doc()
            if session.document:
                ydoc.apply_update(bytes(session.document))
            for update in updates:
                ydoc.apply_update(update)
            session.document = ydoc.get_update()
            session.save(update_fields=["document", "updated_at"])
