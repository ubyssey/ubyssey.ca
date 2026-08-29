# Handles submission of editor data like forms and generates public version of page

import json

from wagtail.fields import StreamField

from .forms import authors, featured_media, metadata
from .serialization import generate_public_streamfield


def json_safe(value):
    return json.loads(json.dumps(value, default=str))


def merge_form_errors(editor_errors, form, prefix=None):
    for field_name, field_errors in form.errors.items():
        key = f"{prefix}.{field_name}" if prefix else field_name
        editor_errors[key] = list(field_errors)


def process_submitted_page(page, data, preview=False):
    editor_errors = {}

    page_form = metadata.create_form(page, data)
    article_authors_form = authors.create_form(page, data)
    featured_media_form = featured_media.create_form(page, data)

    if page_form.is_valid():
        metadata.apply_form(page, page_form)
    else:
        merge_form_errors(editor_errors, page_form)

    if article_authors_form:
        if article_authors_form.is_valid():
            authors.apply_form(page, article_authors_form)
        else:
            merge_form_errors(editor_errors, article_authors_form, "article_authors")

    if featured_media_form:
        if featured_media_form.is_valid():
            featured_media.apply_form(page, featured_media_form)
        else:
            merge_form_errors(editor_errors, featured_media_form, "featured_media")

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
                value = generate_public_streamfield(value)
            setattr(page, field.name, value)
        except json.JSONDecodeError:
            editor_errors[field.name] = [f"Invalid JSON for {field.name}."]

    return editor_errors, page_form, article_authors_form, featured_media_form
