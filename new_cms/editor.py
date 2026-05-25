import json

from wagtail import blocks
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.fields import StreamField as WagtailStreamField
from wagtail.images.blocks import ImageChooserBlock


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
        fields = get_editable_fields(block, name)
        default = get_default_value(block, fields, name)
        definitions[name] = {
            "fields": fields,
            "defaultValue": default,
            "defaultFields": get_editor_fields(default, fields, name),
        }

    return definitions


def get_editable_fields(block, name=None):
    field = get_field_info(block, name) if name else None

    if field:
        return {name: field}

    fields = {}

    for child_name, child_block in getattr(block, "child_blocks", {}).items():
        fields.update(get_editable_fields(child_block, child_name))

    child_block = getattr(block, "child_block", None)
    if child_block:
        fields.update(get_editable_fields(child_block, name))
        fields.update(get_editable_fields(child_block))

    return fields


def get_field_info(block, name):
    kind = get_field_kind(block)

    if not kind:
        return None

    field = {"name": name, "label": getattr(block, "label", None) or name, "kind": kind}

    if kind == "choice":
        field["options"] = get_choice_options(block)

    return json_safe(field)


def get_field_kind(block):
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

    if kind in ("richtext", "plain_text", "unknown"):
        return ""
    if kind == "boolean":
        return False
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

    if isinstance(value, str):
        meta = field_meta.get(block_type)
        if meta and meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field([], meta, value))
        return fields

    walk_value(value, [], fields, field_meta, block_type)
    return fields


def walk_value(value, path, fields, field_meta, block_type):
    name = next((part for part in reversed(path) if isinstance(part, str)), None)
    meta = field_meta.get(name)

    if value is None and meta:
        if meta["kind"] in ("richtext", "plain_text"):
            fields.append(editable_field(path, meta, ""))
        elif meta["kind"] in ("boolean", "choice", "image", "document"):
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
        return

    if isinstance(value, bool):
        if meta and meta["kind"] == "boolean":
            fields.append(control_field(path, meta, value, "boolean"))
        return

    if isinstance(value, list):
        if meta and meta["kind"] == "choice" and len(value) <= 1:
            fields.append(control_field(path, meta, value[0] if value else "", "choice"))
            return
        for index, item in enumerate(value):
            walk_value(item, path + [index], fields, field_meta, block_type)
        return

    if isinstance(value, dict):
        for key, child_value in value.items():
            walk_value(child_value, path + [key], fields, field_meta, block_type)


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
    if field["kind"] == "boolean":
        return False
    if field["kind"] in ("image", "document"):
        return None
    if field["kind"] == "choice":
        options = field.get("options") or []
        return next((option["value"] for option in options if option["value"] != ""), options[0]["value"] if options else "")
    return ""


def json_safe(value):
    return json.loads(json.dumps(value, default=str))

