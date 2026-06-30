import json
import re

from django import forms
from django.core.exceptions import FieldDoesNotExist
from wagtail import blocks
from wagtail.documents import get_document_model
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.fields import RichTextField, StreamField
from wagtail.images import get_image_model
from wagtail.images.blocks import ImageChooserBlock

# I'm only including clearly useful fields for now
PAGE_FORM_FIELDS = (
    "title",
    "title_tag",
    "seo_description",
    "timeliness",
    "slug",
    "explicit_published_at",
    "show_last_modified",
    "disclaimer",
)

PAGE_FORM_LABELS = {
    "title_tag": "Title Tag",
    "seo_description": "Meta Description",
    "explicit_published_at": "Publication Date",
    "show_last_modified": "Show last modified",
}

FEATURED_MEDIA_FIELDS = ("image", "video", "caption", "credit", "alt_text")

FEATURED_MEDIA_LABELS = {
    "image": "Image",
    "video": "Video",
    "alt_text": "Alt text",
}

CONTROL_FIELD_KINDS = {"boolean", "choice", "image", "document", "number", "unknown"}


# Page form

def get_page_form(page, data=None):
    names = get_page_field_names(page)
    widgets = {
        name: forms.Textarea
        for name in names
        if isinstance(page._meta.get_field(name), RichTextField)
    }
    form_class = forms.modelform_factory(page.__class__, fields=names, widgets=widgets, labels=PAGE_FORM_LABELS)
    return form_class(data=data, instance=page) if data is not None else form_class(instance=page)


def get_page_field_names(page):
    return [name for name in PAGE_FORM_FIELDS if is_page_form_field(page, name)]


def is_page_form_field(page, name):
    try:
        field = page._meta.get_field(name)
    except FieldDoesNotExist:
        return False

    if isinstance(field, StreamField) or field.is_relation:
        return False

    return field.editable and field.concrete and field.formfield() is not None


# Featured media form

def get_featured_media_form(page, data=None):
    manager = getattr(page, "featured_media", None)
    model = getattr(manager, "model", None)
    if not manager or not model:
        return None

    form_class = get_featured_media_form_class(model)
    instance = manager.first() or model(**{featured_media_parent_field(model): page, "sort_order": 0})
    kwargs = {"instance": instance, "prefix": "featured_media", "page": page}
    if data is not None:
        kwargs["data"] = data
    return form_class(**kwargs)


def get_featured_media_form_class(model):
    image_model = model._meta.get_field("image").remote_field.model

    class FeaturedMediaForm(forms.ModelForm):
        image = forms.ModelChoiceField(queryset=image_model.objects.none(), required=False, label=FEATURED_MEDIA_LABELS["image"])

        def __init__(self, *args, **kwargs):
            page = kwargs.pop("page")
            super().__init__(*args, **kwargs)
            article_media = getattr(page, "article_media", None)
            ids = [item.image_id for item in article_media.all() if item.image_id] if article_media else []
            if self.instance.image_id:
                ids.append(self.instance.image_id)
            self.fields["image"].queryset = image_model.objects.filter(id__in=ids)
            self.fields["image"].initial = self.instance.image_id

    return forms.modelform_factory(
        model,
        form=FeaturedMediaForm,
        fields=FEATURED_MEDIA_FIELDS,
        labels=FEATURED_MEDIA_LABELS,
    )


def save_featured_media_form(page, form):
    manager = page.featured_media

    if not any(form.cleaned_data.get(name) for name in FEATURED_MEDIA_FIELDS):
        manager.clear()
        return

    items = list(manager.all())
    item = form.save(commit=False)
    setattr(item, featured_media_parent_field(item.__class__), page)
    item.sort_order = items[0].sort_order if items else 0

    manager.set([item] + items[1:] if items else [item])


def featured_media_parent_field(model):
    return next(
        field.name
        for field in model._meta.fields
        if getattr(getattr(field, "remote_field", None), "related_name", None) == "featured_media"
    )


# Article media upload form

def get_article_media_upload_form(data=None, files=None):
    author_model = get_image_model()._meta.get_field("author").remote_field.model

    class ArticleMediaUploadForm(forms.Form):
        media_id = forms.IntegerField(widget=forms.HiddenInput, required=False)
        kind = forms.ChoiceField(choices=(("image", "Image"), ("document", "Document")), initial="image", required=False)
        title = forms.CharField(required=False)
        file = forms.FileField(required=False)
        author = forms.ModelChoiceField(queryset=author_model.objects.all(), required=False)
        description = forms.CharField(widget=forms.Textarea, required=False)
        tags = forms.CharField(required=False, help_text="Separate tags with commas.")

        def clean(self):
            cleaned = super().clean()
            is_edit = cleaned.get("media_id")
            has_anything = is_edit or any(cleaned.get(name) for name in ("title", "file", "author", "tags"))
            has_anything = has_anything or (cleaned.get("kind") == "image" and cleaned.get("description"))
            if has_anything and not cleaned.get("title"):
                self.add_error("title", "Title is required for uploads.")
            if has_anything and not is_edit and not cleaned.get("file"):
                self.add_error("file", "Choose a file to upload.")
            return cleaned

    return ArticleMediaUploadForm(data=data, files=files, prefix="article_media")


def save_article_media_upload(page, form, user=None):
    data = form.cleaned_data
    is_image = data.get("kind") != "document"
    model = get_image_model() if is_image else get_document_model()
    item = model.objects.filter(id=data.get("media_id")).first() if data.get("media_id") else None

    if data.get("media_id") and not item:
        return None
    if not item and not data.get("file"):
        return None

    if not item:
        item = model()
        if user and hasattr(item, "uploaded_by_user"):
            item.uploaded_by_user = user

    item.title = data["title"]
    if data.get("file"):
        item.file = data["file"]
    if is_image:
        item.author = data.get("author")
        item.description = data.get("description") or ""

    item.save()
    item.tags.clear()
    tags = [tag.strip() for tag in (data.get("tags") or "").split(",") if tag.strip()]
    if tags:
        item.tags.add(*tags)

    manager = getattr(page, "article_media", None)
    model = getattr(manager, "model", None)
    if not manager or not model:
        return None

    image = item if is_image else None
    document = item if not is_image else None
    rows = list(manager.all())
    for row in rows:
        if (image and row.image_id == image.id) or (document and row.document_id == document.id):
            return row

    return model.objects.create(article_page=page, image=image, document=document, sort_order=len(rows))


# StreamField editors


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


EDITOR_NOTE_EMPTY_ANCHOR_RE = re.compile(r'<span\b(?=[^>]*\bdata-footnote-anchor=(?:"true"|\'true\'))[^>]*>.*?</span>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ANCHOR_RE = re.compile(r'<(?:span|mark)\b(?=[^>]*\bdata-(?:comment-thread|footnote)-id=)[^>]*>(.*?)</(?:span|mark)>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ATTR_RE = re.compile(r'\sdata-(?:comment-(?:thread-id|comments|pending|resolved)|footnote-(?:id|text|anchor))=("[^"]*"|\'[^\']*\'|[^\s>]+)', re.IGNORECASE)
# Placing footnotes inside links broke them in public version -> possible issue for other elements too
ADJACENT_LINK_RE = re.compile(r'<a\b(?P<attrs>[^>]*)>(?P<left>.*?)</a>\s*<a\b(?P=attrs)>(?P<right>.*?)</a>', re.IGNORECASE | re.DOTALL)


def get_streamfield_editors(page):
    editors = {}

    for field in page._meta.get_fields():
        if not isinstance(field, StreamField):
            continue

        registry = get_block_definitions(field.stream_block)
        raw = []

        try:
            comments = getattr(page, "stove_comment_data", None) or {}
            if isinstance(comments, dict) and field.name in comments:
                raw = comments.get(field.name) or []
            else:
                raw = json_safe(field.stream_block.get_prep_value(getattr(page, field.name))) or []
        except Exception:
            print("Failed to get field: " + field.name)

        editors[field.name] = {
            "blocks": get_editor_blocks(raw, registry),
            "blockTypes": get_editor_block_types(registry),
        }

    return editors


def get_editor_block_types(registry):
    return {
        name: {
            "defaultValue": definition["defaultValue"],
            "defaultFields": definition["defaultFields"],
        }
        for name, definition in registry.items()
    }


def get_block_definitions(stream_block):
    definitions = {}

    for name, block in stream_block.child_blocks.items():
        fields = get_editable_fields(block, name, include_name=False)
        default = get_default_value(block, fields, name)
        definitions[name] = {
            "fields": fields,
            "defaultValue": default,
            "defaultFields": get_editor_fields(default, fields, name),
        }

    return definitions


def get_editor_blocks(raw_blocks, registry):
    return [
        {
            "type": block.get("type", "unknown"),
            "id": block.get("id"),
            "value": block.get("value"),
            "comments": block.get("comments") or [],
            "fields": get_editor_fields(
                block.get("value"),
                registry.get(block.get("type", "unknown"), {}).get("fields", {}),
                block.get("type", "unknown"),
            ),
        }
        for block in raw_blocks
    ]


# StreamField block fields

def get_editable_fields(block, name=None, path=None, include_name=True):
    path = path or []
    field_path = path + [name] if name else path
    field = get_field_info(block, name, field_path) if name else None

    if field:
        return {name: field}

    fields = {}
    child_path = path + ([name] if name and include_name else [])

    for child_name, child_block in getattr(block, "child_blocks", {}).items():
        fields.update(get_editable_fields(child_block, child_name, child_path))

    child_block = getattr(block, "child_block", None)
    if child_block:
        if getattr(child_block, "child_blocks", None):
            fields.update(get_editable_fields(child_block, path=[], include_name=False))
        else:
            fields.update(get_editable_fields(child_block, name, []))

    return fields


def get_field_info(block, name, path=None):
    kind = get_field_kind(block)

    if not kind:
        return None

    field = {"name": name, "label": getattr(block, "label", None) or name, "kind": kind, "path": path or [name]}

    if kind == "choice":
        field["options"] = get_choice_options(block)
    elif kind == "list":
        if getattr(block.child_block, "child_blocks", None):
            child_fields = get_editable_fields(block.child_block, path=[], include_name=False)
        else:
            child_fields = get_editable_fields(block.child_block, name, [])
        item_value = get_default_value(block.child_block, child_fields, name)
        field.update({
            "itemValue": item_value,
            "itemFields": get_editor_fields(item_value, child_fields, name),
            "itemFieldMeta": child_fields,
        })

    return json_safe(field)


def get_field_kind(block):
    if isinstance(block, blocks.ListBlock):
        return "list"
    if isinstance(block, blocks.RichTextBlock):
        return "richtext"
    if isinstance(block, ImageChooserBlock):
        return "image"
    if isinstance(block, DocumentChooserBlock):
        return "document"
    if isinstance(block, blocks.ChoiceBlock):
        return "choice"
    if isinstance(block, blocks.BooleanBlock):
        return "boolean"
    if isinstance(block, blocks.IntegerBlock):
        return "number"
    if isinstance(block, (blocks.CharBlock, blocks.TextBlock, blocks.URLBlock, blocks.RawHTMLBlock)):
        return "plain_text"

    widget = getattr(getattr(block, "field", None), "widget", None)
    input_type = getattr(widget, "input_type", "")

    if input_type in ("text", "url", "email") or widget.__class__.__name__ == "Textarea":
        return "plain_text"
    if widget:
        return "unknown"

    return None


def get_default_value(block, fields, name):
    kind = get_field_kind(block)

    if kind == "list":
        return []
    if kind in ("richtext", "plain_text", "unknown"):
        return ""
    if kind == "boolean":
        return False
    if kind == "number":
        return 0
    if kind in ("image", "document"):
        return None
    if kind == "choice":
        options = get_choice_options(block)
        return next((option["value"] for option in options if option["value"] != ""), options[0]["value"] if options else "")

    try:
        return json_safe(block.get_prep_value(block.get_default()))
    except Exception:
        return {field_name: get_empty_value(field) for field_name, field in fields.items()} or None


def get_choice_options(block):
    return [
        {"value": value, "label": str(label)}
        for value, label in list(getattr(block.field, "choices", []))
    ]


def get_editor_fields(value, field_meta, block_type):
    field = editor_field_for_value([], field_meta.get(block_type), value)
    if field:
        return [field]

    fields = []
    walk_value(value, [], fields, field_meta)
    return fields


def walk_value(value, path, fields, field_meta):
    name = next((part for part in reversed(path) if isinstance(part, str)), None)
    field = editor_field_for_value(path, field_meta.get(name), value)
    if field:
        fields.append(field)
        return

    if isinstance(value, list):
        for index, item in enumerate(value):
            walk_value(item, path + [index], fields, field_meta)
        return

    if isinstance(value, dict):
        for key, child_value in value.items():
            walk_value(child_value, path + [key], fields, field_meta)

        for missing_field in direct_missing_fields(value, path, field_meta):
            field = empty_editor_field(path + [missing_field], field_meta[missing_field])
            if field:
                fields.append(field)


def editor_field_for_value(path, meta, value):
    if not meta:
        return None

    kind = meta["kind"]

    if value is None:
        return empty_editor_field(path, meta)

    if isinstance(value, list):
        if kind == "list":
            return list_field(path, meta, value)
        if kind == "choice" and len(value) <= 1:
            return control_field(path, meta, value[0] if value else "", "choice")
        return None

    if isinstance(value, str):
        if kind in ("richtext", "plain_text"):
            return editable_field(path, meta, value)
        if kind in ("choice", "image", "document", "unknown"):
            return control_field(path, meta, value, kind)
        return None

    if isinstance(value, bool):
        return control_field(path, meta, value, "boolean") if kind == "boolean" else None

    if isinstance(value, (int, float)) and kind in ("number", "image", "document", "unknown"):
        return control_field(path, meta, value, kind)

    return None


def empty_editor_field(path, meta):
    if meta["kind"] in ("richtext", "plain_text"):
        return editable_field(path, meta, "")
    if meta["kind"] == "list":
        return list_field(path, meta, [])
    if meta["kind"] in CONTROL_FIELD_KINDS:
        return control_field(path, meta, get_empty_value(meta), meta["kind"])
    return None


def direct_missing_fields(value, path, field_meta):
    missing = []
    for field_name, meta in field_meta.items():
        if meta.get("path") == path + [field_name] and field_name not in value:
            missing.append(field_name)
    return missing


def list_field(path, meta, value):
    return {
        "kind": "list",
        "path": path,
        "label": meta.get("label") or "List",
        "itemValue": meta.get("itemValue"),
        "itemFields": meta.get("itemFields") or [],
        "items": [
            {
                "value": item,
                "fields": get_editor_fields(item, meta.get("itemFieldMeta") or {}, meta["name"]),
            }
            for item in (value or [])
        ],
    }


def editable_field(path, meta, value):
    return {
        "kind": "editable",
        "path": path,
        "label": meta.get("label") or "Content",
        "mode": "plain_text" if meta["kind"] == "plain_text" else "richtext",
        "value": value,
    }


def control_field(path, meta, value, control_type):
    return {
        "kind": "control",
        "path": path,
        "label": meta.get("label") or "Field",
        "controlType": control_type,
        "value": value,
        "options": meta.get("options"),
    }


def get_empty_value(field):
    if field["kind"] == "list":
        return []
    if field["kind"] == "boolean":
        return False
    if field["kind"] == "number":
        return 0
    if field["kind"] in ("image", "document"):
        return None
    if field["kind"] == "choice":
        options = field.get("options") or []
        return next((option["value"] for option in options if option["value"] != ""), options[0]["value"] if options else "")
    return ""


# Editor Post Handling

def apply_editor_post(page, data, preview=False):
    editor_errors = {}
    page_form = get_page_form(page, data)
    featured_media_form = get_featured_media_form(page, data)
    if page_form.is_valid():
        for field_name, value in page_form.cleaned_data.items():
            setattr(page, field_name, value)
    else:
        add_form_errors(editor_errors, page_form)

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
            if preview:
                value = sanitize_preview_stream_value(value)
                if hasattr(page, "stove_comment_data"):
                    value = public_stream_value(value)
                setattr(page, field.name, value)
            else:
                if hasattr(page, "stove_comment_data"):
                    editor_data = getattr(page, "stove_comment_data", None) or {}
                    if not isinstance(editor_data, dict):
                        editor_data = {}
                    editor_data[field.name] = json_safe(value) or []
                    page.stove_comment_data = editor_data
                    value = public_stream_value(value)
                setattr(page, field.name, value)
        except json.JSONDecodeError:
            editor_errors[field.name] = ["Invalid JSON for this field."]

    return editor_errors, page_form, featured_media_form


def sanitize_preview_stream_value(value):
    if isinstance(value, list):
        items = []
        for item in value:
            sanitized_item = sanitize_preview_stream_value(item)
            if sanitized_item is not None or not (isinstance(item, dict) and item.get("type") == "audio"):
                items.append(sanitized_item)
        return items

    if isinstance(value, dict) and value.get("type") == "audio":
        block_value = value.get("value")
        if not isinstance(block_value, dict) or not block_value:
            return None

        audio_id = block_value.get("audio")
        nested_block = block_value.get("block")
        if audio_id is None and isinstance(nested_block, dict):
            audio_id = nested_block.get("audio")

        if not audio_id:
            return None

        try:
            audio_id = int(audio_id)
        except (TypeError, ValueError):
            return None

        if not get_document_model().objects.filter(id=audio_id).exists():
            return None

    if isinstance(value, dict):
        return {key: sanitize_preview_stream_value(item) for key, item in value.items()}

    return value


# Utils

def json_safe(value):
    return json.loads(json.dumps(value, default=str))


def add_form_errors(editor_errors, form, prefix=None):
    for field_name, field_errors in form.errors.items():
        key = f"{prefix}.{field_name}" if prefix else field_name
        editor_errors[key] = list(field_errors)
