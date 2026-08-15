# Handles submission of editor data
# parses each steam_<field name> json
# coordinates a bunch of the other editor python stuff

# this does not save revision or publish the page (that happens in views.py)

# Removes editor only data from StreamField values
# ie footnotes and comments from html

# The prosemirror classes in article templates are necessary unless we duplicate the article html completely
# (actually maybe we could strip it dynamically before we send it but that sounds terrible)

import json
import re

from wagtail.fields import StreamField

from .forms.authors import get_article_authors_form, save_article_authors_form
from .forms.featured_media import get_featured_media_form, save_featured_media_form
from .forms.metadata import get_page_form

# Creates public version of page
def public_stream_value(value):
    if isinstance(value, list):
        return [public_stream_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: public_stream_value(child_value)
            for key, child_value in value.items()
            if key != "comments" or not ("type" in value and "value" in value)
        }
    # Browser serialized line breaks as <br> which breaks Wagtail
    if isinstance(value, str):
        value = BR_RE.sub('<br/>', value)
    if isinstance(value, str) and ("data-comment-" in value or "data-footnote-" in value):
        previous = None
        stripped = value
        stripped = EDITOR_NOTE_EMPTY_ANCHOR_RE.sub('', stripped)
        while previous != stripped:
            previous = stripped
            stripped = EDITOR_NOTE_ANCHOR_RE.sub(r'\1', stripped)
        stripped = EDITOR_NOTE_ATTR_RE.sub('', stripped)
        previous = None
        while previous != stripped:
            previous = stripped
            stripped = ADJACENT_LINK_RE.sub(r'<a\g<attrs>>\g<left>\g<right></a>', stripped)
        return stripped
    return value


# Good luck
BR_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
EDITOR_NOTE_EMPTY_ANCHOR_RE = re.compile(r'<span\b(?=[^>]*\bdata-footnote-anchor=(?:"true"|\'true\'))[^>]*>.*?</span>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ANCHOR_RE = re.compile(r'<(?:span|mark)\b(?=[^>]*\bdata-(?:comment-thread|footnote)-id=)[^>]*>(.*?)</(?:span|mark)>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ATTR_RE = re.compile(r'\sdata-(?:comment-(?:thread-id|comments|pending|resolved)|footnote-(?:id|text|anchor))=("[^"]*"|\'[^\']*\'|[^\s>]+)', re.IGNORECASE)
# Placing footnotes inside links broke them in public version -> possible issue for other elements too
ADJACENT_LINK_RE = re.compile(r'<a\b(?P<attrs>[^>]*)>(?P<left>.*?)</a>\s*<a\b(?P=attrs)>(?P<right>.*?)</a>', re.IGNORECASE | re.DOTALL)


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
