# Converts wagtail StreamField data into more normal JSON structure for the editor
# This is probably the messiest bit right now

# todo: find out how much is reusable for other page types

from wagtail import blocks
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock
import json

CONTROL_FIELD_KINDS = {"boolean", "choice", "image", "document", "number", "unknown"}


# Main entrypoint for editor initialization
# Builds JSON for each streamfield
# streamfields contain blocks which contains blocks (struct or list block) or fields
def get_streamfield_editors(page):
    editors = {}

    for field in page._meta.get_fields():
        if not isinstance(field, StreamField):
            continue

        registry = get_block_definitions(field.stream_block)
        raw = []
        try:
            comments = getattr(page, "editor_article_version", None) or {}
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


# Gets block types for each editor, ie different for header vs content
def get_editor_block_types(registry):
    return {
        name: {
            "defaultValue": definition["defaultValue"],
            "defaultFields": definition["defaultFields"],
        }
        for name, definition in registry.items()
    }


# Gathers metadata for each block
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


# Custom format to simplify client side
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


# Finds nested blocks within struct and list blocks
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


# Creates metadata for choice and list fields todo: clean this or factor it out or something
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


# Converts blocks into the format consumed by frontend
def get_editor_fields(value, field_meta, block_type):
    field = editor_field_for_value([], field_meta.get(block_type), value)
    if field:
        return [field]

    fields = []
    walk_value(value, [], fields, field_meta)
    return fields


# recursive helper for get_editor_fields
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


# Maps fields to editor type, ie checkbox for boolean
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


def json_safe(value):
    return json.loads(json.dumps(value, default=str))
