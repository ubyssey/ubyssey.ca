import asyncio
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.db import transaction

# pycrdt provides python bindings to rust port of YJS which is the library used here for collaboration
from pycrdt import Doc, YMessageType, YSyncMessageType, create_sync_message, read_message
from pycrdt.websocket.django_channels_consumer import (
    YjsConsumer,
    handle_sync_message,
)

from wagtail.models import Page
from stove.models import PageCollaboration
from stove.editors.collaboration.wagtail import WAGTAIL_EDITING_CLOSE_CODE, page_is_being_edited_in_wagtail
from stove.editors.collaboration.presence import PRESENCE_REFRESH_SECONDS, refresh_page_presence

# Formerly was 0.25
PERSISTENCE_BATCH_DELAY_SECONDS = 0.1

# Used in collabaration.js, code sent which tells clients to reload vs applying local YJS state (maybe a bad move)
RESTORE_CLOSE_CODE = 4410

# Sent after changes are merged in
PERSISTENCE_ACK_MESSAGE = 4


# This channel is used to tell all connected editors that a restore happened
def page_restore_group_name(page_id):
    return f"stove_yjs_restore_{page_id}"


def page_yjs_group_name(page_id):
    return f"stove_yjs_{page_id}"


# State vector contains clock for each client ID
def create_persistence_ack_message(state_vector):
    return bytes([PERSISTENCE_ACK_MESSAGE]) + state_vector

# Sync Y document with a Wagtail page
class PageYjsConsumer(YjsConsumer):

    def __init__(self):
        super().__init__()
        self.page_id = None
        self._pending_updates = []
        self._pending_messages = []
        self._persistence_task = None
        self._presence_refresh_task = None
        self.presence_id = None
        # Page collaboration object PK
        self.collaboration_id = None

    # Figure out proper authentification here, maybe use assignment manager assignments?
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=4401)
            return

        self.page_id = int(self.scope["url_route"]["kwargs"]["page_id"])
        query_params = parse_qs(self.scope["query_string"].decode())
        self.presence_id = query_params.get("presence", [None])[0]

        if self.presence_id is None:
            await self.close(code=4400)
            return
        if not await self._page_exists():
            await self.close(code=4404)
            return
        if await self._page_is_being_edited_in_wagtail():
            await self.close(code=WAGTAIL_EDITING_CLOSE_CODE)
            return
        if not await self._refresh_stove_presence():
            await self.close(code=4400)
            return

        self.room_name = self.make_room_name()
        self.ydoc = Doc()
        self._websocket_shim = self._make_websocket_shim(self.scope["path"])

        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.channel_layer.group_add(page_restore_group_name(self.page_id), self.channel_name)

        self.collaboration_id, saved_document = await self._load_document()
        if saved_document:
            self.ydoc.apply_update(saved_document)

        await self.accept()

        self._presence_refresh_task = asyncio.create_task(
            self._refresh_stove_presence_loop()
        )
        
        await self._websocket_shim.send(create_sync_message(self.ydoc))

    async def disconnect(self, code):
        if self._presence_refresh_task:
            self._presence_refresh_task.cancel()
            await asyncio.gather(self._presence_refresh_task, return_exceptions=True)
            self._presence_refresh_task = None
        if self.page_id is not None:
            await self.channel_layer.group_discard(
                page_restore_group_name(self.page_id),
                self.channel_name,
            )
        if self.room_name:
            await super().disconnect(code)
        # Waits for last edits here before saving
        if self._persistence_task:
            await asyncio.gather(self._persistence_task, return_exceptions=True)
        if self._pending_updates:
            updates = self._pending_updates
            messages = self._pending_messages
            self._pending_updates = []
            self._pending_messages = []
            await self._persist_updates(updates, messages)

    def make_room_name(self):
        return page_yjs_group_name(self.page_id)

    async def page_restored(self, event):
        await self.close(code=RESTORE_CLOSE_CODE)

    async def page_wagtail_edit_started(self, event):
        await self.close(code=WAGTAIL_EDITING_CLOSE_CODE)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is None:
            return

        if bytes_data[0] != YMessageType.SYNC:
            await self.group_send_message(bytes_data)
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
                self._pending_messages.append(bytes_data)
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
                messages = self._pending_messages[:batch_size]
                await self._persist_updates(updates, messages)
                del self._pending_updates[:batch_size]
                del self._pending_messages[:batch_size]
        finally:
            self._persistence_task = None

    async def _persist_updates(self, updates, messages):
        state_vector = await self._merge_document(updates)
        if state_vector is None:
            return

        for message in messages:
            await self.group_send_message(message)

        # Confirms only for editor that sent the changes
        await self.send(bytes_data=create_persistence_ack_message(state_vector))

    async def _refresh_stove_presence_loop(self):
        while True:
            await asyncio.sleep(PRESENCE_REFRESH_SECONDS)
            if not await self._refresh_stove_presence():
                return

    @database_sync_to_async
    def _page_exists(self):
        return Page.objects.filter(pk=self.page_id).exists()

    @database_sync_to_async
    def _page_is_being_edited_in_wagtail(self):
        return page_is_being_edited_in_wagtail(self.page_id)

    @database_sync_to_async
    def _refresh_stove_presence(self):
        return refresh_page_presence(self.page_id, self.presence_id)

    @database_sync_to_async
    def _load_document(self):
        session = (
            PageCollaboration.objects.filter(page_id=self.page_id)
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
            session = PageCollaboration.objects.select_for_update().filter(
                pk=self.collaboration_id,
                page_id=self.page_id,
            ).first()
            if session is None:
                return None
            ydoc = Doc()
            if session.document:
                ydoc.apply_update(bytes(session.document))
            for update in updates:
                ydoc.apply_update(update)
            session.document = ydoc.get_update()
            session.save(update_fields=["document", "updated_at"])
            return ydoc.get_state()
