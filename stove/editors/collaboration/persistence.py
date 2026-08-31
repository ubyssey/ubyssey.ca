from django.db import transaction
from pycrdt import Doc
from wagtail.models import Page

from stove.models import PageCollaboration


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
