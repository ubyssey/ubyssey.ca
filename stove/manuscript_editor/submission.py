# Handles submission of editor data
# parses each steam_<field name> json
# coordinates a bunch of the other editor python stuff

# this does not save revision or publish the page (that happens in views.py)

import json

from wagtail.fields import StreamField

from .authors import get_article_authors_form, save_article_authors_form
from .featured_media import get_featured_media_form, save_featured_media_form
from .page_forms import get_page_form
from .stream_serialization import public_stream_value


def json_safe(value):
    return json.loads(json.dumps(value, default=str))


def add_form_errors(editor_errors, form, prefix=None):
    for field_name, field_errors in form.errors.items():
        key = f"{prefix}.{field_name}" if prefix else field_name
        editor_errors[key] = list(field_errors)


def apply_editor_post(page, data, preview=False):
    editor_errors = {}
    page_form = get_page_form(page, data)
    article_authors_form = get_article_authors_form(page, data)
    featured_media_form = get_featured_media_form(page, data)
    if page_form.is_valid():
        for field_name, value in page_form.cleaned_data.items():
            setattr(page, field_name, value)
    else:
        add_form_errors(editor_errors, page_form)

    if article_authors_form:
        if article_authors_form.is_valid():
            save_article_authors_form(page, article_authors_form)
        else:
            add_form_errors(editor_errors, article_authors_form, "article_authors")

    if featured_media_form:
        if featured_media_form.is_valid():
            save_featured_media_form(page, featured_media_form)
        else:
            add_form_errors(editor_errors, featured_media_form, "featured_media")

    for field in page._meta.get_fields():
        if not isinstance(field, StreamField):
            continue
        json_str = data.get(f"stream_{field.name}", "").strip()
        if not json_str:
            continue
        try:
            value = json.loads(json_str)
            if hasattr(page, "editor_article_version"):
                if not preview:
                    editor_data = getattr(page, "editor_article_version", None) or {}
                    if not isinstance(editor_data, dict):
                        editor_data = {}
                    editor_data[field.name] = json_safe(value) or []
                    page.editor_article_version = editor_data
                value = public_stream_value(value)
            setattr(page, field.name, value)
        except json.JSONDecodeError:
            editor_errors[field.name] = ["Invalid JSON for this field."]

    return editor_errors, page_form, article_authors_form, featured_media_form
