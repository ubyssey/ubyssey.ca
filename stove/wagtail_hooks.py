from django.shortcuts import render
from django.urls import reverse
from wagtail import hooks

from home.models import HomePage
from stove.models import PageCollaboration
from stove.editors.collaboration.wagtail import hand_page_to_wagtail


@hooks.register("before_edit_page")
def require_stove_handoff_before_wagtail_edit(request, page):
    if request.method != "GET" or not PageCollaboration.objects.filter(page_id=page.id).exists():
        return None

    if not hand_page_to_wagtail(page.id, True):
        stove_editor_url = (
            reverse("stove:homepage_editor")
            if isinstance(page.specific, HomePage)
            else reverse("stove:manuscript_editor", args=[page.id])
        )
        return render(
            request,
            "editors/wagtail_handoff_required.html",
            {"stove_editor_url": stove_editor_url},
            status=409,
        )
