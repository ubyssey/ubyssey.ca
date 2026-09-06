from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from pycrdt import Array, Doc, Map, Text, create_update_message
from wagtail.models import Page

from stove.models import PageCollaboration
from stove.editors.collaboration.consumers import page_yjs_group_name

# We can't overwrite directly since the assigment manager only contains these roles
ASSIGNMENT_AUTHOR_ROLES = ["author", "backfield_editor", "copy_editor"]


def initialize_page_collaboration(page_id, initial_update):
    document = Doc()
    document.apply_update(initial_update)

    with transaction.atomic():
        page = Page.objects.select_for_update().only("pk").get(pk=page_id)
        collaboration, _ = PageCollaboration.objects.get_or_create(page=page)
        if not collaboration.document:
            collaboration.document = initial_update
            collaboration.save(update_fields=["document", "updated_at"])

        return bytes(collaboration.document)


def update_page_collaboration(page, data):
    with transaction.atomic():
        Page.objects.select_for_update().only("pk").get(pk=page.pk)
        collaboration = PageCollaboration.objects.select_for_update().filter(page_id=page.pk).first()
        if not collaboration or not collaboration.document:
            return

        document = Doc()
        document.apply_update(bytes(collaboration.document))
        state = document.get_state()
        metadata = document.get("metadata", type=Map)

        if "title" in data:
            title = metadata.get("field:title")
            if isinstance(title, Text):
                title.clear()
                title.insert(0, page.title)
            else:
                metadata["field:title"] = Text(page.title)
        if "authors" in data:
            assignment_authors = [
                {"authorId": str(item.author_id), "role": item.author_role}
                for item in page.article_authors.all()
                if item.author_role in ASSIGNMENT_AUTHOR_ROLES
            ]
            authors = metadata.get("articleAuthors")
            if isinstance(authors, Array):
                manuscript_authors = [
                    item for item in authors.to_py()
                    if item["role"] not in ASSIGNMENT_AUTHOR_ROLES
                ]
                authors.clear()
                authors.extend([Map(item) for item in assignment_authors + manuscript_authors])
            else:
                metadata["articleAuthors"] = Array([Map(item) for item in assignment_authors])

        update = document.get_update(state)
        if not update:
            return

        collaboration.document = document.get_update()
        collaboration.save(update_fields=["document", "updated_at"])
        transaction.on_commit(lambda: send_page_update(page.pk, update))


def send_page_update(page_id, update):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        page_yjs_group_name(page_id),
        {"type": "send_message", "message": create_update_message(update)},
    )
