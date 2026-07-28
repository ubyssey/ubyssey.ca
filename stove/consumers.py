import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer


class ManuscriptEditorConsumer(WebsocketConsumer):
    def connect(self):
        if not self.scope["user"].is_authenticated:
            self.close(code=4401)
            return

        # Rooms are pages
        self.page_id = self.scope["url_route"]["kwargs"]["page_id"]
        self.room_group_name = f"stove_manuscript_{self.page_id}"

        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )
        self.accept()
        self.send_message({
            # See stove/socket/users.js for message types (todo write docs maybe)
            "type": "user.connected",
            "connection_id": self.channel_name,
        })

    def disconnect(self, close_code):
        self.broadcast({
            "type": "user.leave",
            "connection_id": self.channel_name,
        })
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )

    # Receive message from one browser, and broadcast it to the rest
    def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            self.close(code=4400)
            return

        try:
            message = json.loads(text_data)
        except (TypeError, json.JSONDecodeError):
            self.close(code=4400)
            return

        if not isinstance(message, dict):
            self.close(code=4400)
            return

        self.broadcast(message)

    def broadcast(self, message):
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name,
            {   
                # This means is handled by manuscript_message function below
                "type": "manuscript.message",
                "message": message,
                "sender": self.channel_name,
            },
        )

    def manuscript_message(self, event):
        if event["sender"] == self.channel_name:
            return
        self.send_message(event["message"])

    def send_message(self, message):
        self.send(text_data=json.dumps(message))
