from django.shortcuts import render
from django.urls import reverse
from wagtail import hooks

from home.models import HomePage
from stove.models import PageCollaboration
from stove.editors.collaboration.wagtail import hand_page_to_wagtail
from stove.editors.collaboration.revisions import (
    STOVE_AUTOSAVE_ACTION,
    STOVE_RESTORE_ACTION,
    STOVE_SAVE_ACTION,
    STOVE_SAVE_BEFORE_RESTORE_ACTION,
)


# Allows Wagtail to display Stove manuscript revisions in the history panel
# https://docs.wagtail.org/en/latest/reference/hooks.html#register-log-actions
@hooks.register("register_log_actions")
def register_stove_log_actions(actions):
    actions.register_action(STOVE_AUTOSAVE_ACTION, "Autosaved in Stove", "Autosaved in Stove")
    actions.register_action(STOVE_SAVE_ACTION, "Saved in Stove", "Saved in Stove")
    actions.register_action(STOVE_SAVE_BEFORE_RESTORE_ACTION, "Saved most recent version before restore in Stove", "Saved most recent version before restore in Stove")
    actions.register_action(STOVE_RESTORE_ACTION, "Restored old version in Stove", "Restored old version in Stove")


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
