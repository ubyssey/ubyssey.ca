import json

from django import forms
from django.core.exceptions import FieldDoesNotExist
from wagtail import blocks
from wagtail.documents import get_document_model
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.fields import RichTextField as WagtailRichTextField, StreamField as WagtailStreamField
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


def get_page_form(page, data=None):
    names = get_page_field_names(page)
    widgets = {
        name: forms.Textarea
        for name in names
        if isinstance(page._meta.get_field(name), WagtailRichTextField)
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

    if isinstance(field, WagtailStreamField) or field.is_relation:
        return False

    return field.editable and field.concrete and field.formfield() is not None


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


def get_article_media_choices(items):
    return {
        "image": [{"value": item.image_id, "label": item.image.title} for item in items if item.image_id],
        "document": [{"value": item.document_id, "label": item.document.title} for item in items if item.document_id],
    }


def get_streamfields(page):
    streamfield_blocks = {}
    block_registry = {}
    editor_data = {}

    for field in page._meta.get_fields():
        if not isinstance(field, WagtailStreamField):
            continue

        registry = get_block_definitions(field.stream_block)
        raw = []

        try:
            raw = json_safe(field.stream_block.get_prep_value(getattr(page, field.name))) or []
        except Exception:
            print("Failed to get field: " + field.name)

        streamfield_blocks[field.name] = json.dumps(raw, indent=2, default=str)
        block_registry[field.name] = registry
        editor_data[field.name] = get_editor_blocks(raw, registry)

    return streamfield_blocks, block_registry, editor_data


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


def get_editor_blocks(raw_blocks, registry):
    return [
        {
            "type": block.get("type", "unknown"),
            "id": block.get("id"),
            "value": block.get("value"),
            "fields": get_editor_fields(
                block.get("value"),
                registry.get(block.get("type", "unknown"), {}).get("fields", {}),
                block.get("type", "unknown"),
            ),
        }
        for block in raw_blocks
    ]


def get_editor_fields(value, field_meta, block_type):
    fields = []
    meta = field_meta.get(block_type)

    if isinstance(value, list):
        if meta and meta["kind"] == "list":
            fields.append(list_field([], meta, value))
            return fields
        if meta and meta["kind"] == "choice" and len(value) <= 1:
            fields.append(control_field([], meta, value[0] if value else "", "choice"))
            return fields

    if value is None and meta:
        if meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field([], meta, ""))
        elif meta["kind"] in ("boolean", "choice", "image", "document", "number", "unknown"):
            fields.append(control_field([], meta, get_empty_value(meta), meta["kind"]))
        return fields

    if isinstance(value, str):
        if meta and meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field([], meta, value))
        elif meta and meta["kind"] == "choice":
            fields.append(control_field([], meta, value, "choice"))
        elif meta and meta["kind"] in ("image", "document"):
            fields.append(control_field([], meta, value, meta["kind"]))
        elif meta and meta["kind"] == "unknown":
            fields.append(control_field([], meta, value, "unknown"))
        return fields

    if isinstance(value, bool):
        if meta and meta["kind"] == "boolean":
            fields.append(control_field([], meta, value, "boolean"))
        return fields

    if isinstance(value, (int, float)):
        if meta and meta["kind"] == "number":
            fields.append(control_field([], meta, value, "number"))
        elif meta and meta["kind"] in ("image", "document"):
            fields.append(control_field([], meta, value, meta["kind"]))
        elif meta and meta["kind"] == "unknown":
            fields.append(control_field([], meta, value, "unknown"))
        return fields

    walk_value(value, [], fields, field_meta, block_type)
    return fields


def walk_value(value, path, fields, field_meta, block_type):
    name = next((part for part in reversed(path) if isinstance(part, str)), None)
    meta = field_meta.get(name)

    if value is None and meta:
        if meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field(path, meta, ""))
        elif meta["kind"] == "list":
            fields.append(list_field(path, meta, []))
        elif meta["kind"] in ("boolean", "choice", "image", "document", "number", "unknown"):
            fields.append(control_field(path, meta, get_empty_value(meta), meta["kind"]))
        return

    if meta and meta["kind"] in ("image", "document") and isinstance(value, (int, str)):
        fields.append(control_field(path, meta, value, meta["kind"]))
        return

    if isinstance(value, str):
        if meta and meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field(path, meta, value))
        elif meta and meta["kind"] == "choice":
            fields.append(control_field(path, meta, value, "choice"))
        elif meta and meta["kind"] == "unknown":
            fields.append(control_field(path, meta, value, "unknown"))
        return

    if isinstance(value, bool):
        if meta and meta["kind"] == "boolean":
            fields.append(control_field(path, meta, value, "boolean"))
        return

    if isinstance(value, (int, float)):
        if meta and meta["kind"] == "number":
            fields.append(control_field(path, meta, value, "number"))
        elif meta and meta["kind"] == "unknown":
            fields.append(control_field(path, meta, value, "unknown"))
        return

    if isinstance(value, list):
        if meta and meta["kind"] == "list":
            fields.append(list_field(path, meta, value))
            return
        if meta and meta["kind"] == "choice" and len(value) <= 1:
            fields.append(control_field(path, meta, value[0] if value else "", "choice"))
            return
        for index, item in enumerate(value):
            walk_value(item, path + [index], fields, field_meta, block_type)
        return

    if isinstance(value, dict):
        for key, child_value in value.items():
            walk_value(child_value, path + [key], fields, field_meta, block_type)

        for missing_field in direct_missing_fields(value, path, field_meta):
            meta = field_meta[missing_field]
            missing_path = path + [missing_field]
            if meta["kind"] in ("richtext", "plain_text"):
                fields.append(editable_field(missing_path, meta, ""))
            elif meta["kind"] == "list":
                fields.append(list_field(missing_path, meta, []))
            elif meta["kind"] in ("boolean", "choice", "image", "document", "number", "unknown"):
                fields.append(control_field(missing_path, meta, get_empty_value(meta), meta["kind"]))


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


def json_safe(value):
    return json.loads(json.dumps(value, default=str))

