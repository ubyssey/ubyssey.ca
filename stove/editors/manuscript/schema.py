# Converts wagtail StreamField data into more normal JSON structure for the editor
# This is probably the messiest bit right now

# todo: find out how much is reusable for other page types
import json

from wagtail import blocks
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock


# Main entrypoint for editor initialization
# Builds JSON for each streamfield
# streamfields contain blocks which contains blocks (struct or list block) or fields
def get_streamfield_editors(page):
    editors = {}

    for field in page._meta.get_fields():
        if not isinstance(field, StreamField):
            continue

        block_types = field.stream_block.child_blocks
        try:
            editor_version = getattr(page, "editor_article_version", None) or {}
            if field.name in editor_version:
                value = editor_version[field.name] or []
            else:
                value = field.stream_block.get_prep_value(getattr(page, field.name))
            value = json_safe(value) or []
        except Exception:
            print(f"Failed to get field: {field.name}")
            value = []

        editors[field.name] = {
            "blocks": get_editor_blocks(value, block_types),
            "blockTypes": get_editor_block_types(block_types),
        }

    return editors


# Gets block types for each editor, ie different for header vs content
def get_editor_block_types(block_types):
    definitions = {}

    for name, block in block_types.items():
        default_value = get_default_value(block)
        definitions[name] = {
            "defaultValue": default_value,
            "defaultField": get_editor_field(block, default_value),
        }

    return definitions


# Custom format to simplify client side
def get_editor_blocks(raw_blocks, block_types):
    editor_blocks = []

    for raw_block in raw_blocks:
        block_type = raw_block.get("type", "unknown")
        block = block_types.get(block_type)
        value = raw_block.get("value")
        editor_blocks.append({
            "type": block_type,
            "id": raw_block.get("id"),
            "value": value,
            "comments": raw_block.get("comments") or [],
            "field": get_editor_field(block, value) if block else None,
        })

    return editor_blocks


# Finds nested blocks within struct and list blocks
def get_editor_field(block, value, path=None):
    path = path or []
    kind = get_field_kind(block)
    label = getattr(block, "label", None) or "Field"

    if kind == "struct":
        value = json_safe(value) if value is not None else {}
        if not isinstance(value, dict) and len(block.child_blocks) == 1:
            child_name = next(iter(block.child_blocks))
            value = {child_name: value}

        return {
            "kind": "struct",
            "path": path,
            "label": label,
            "value": value,
            "fields": [
                get_editor_field(
                    child_block,
                    value.get(name, get_default_value(child_block)),
                    [name],
                )
                for name, child_block in block.child_blocks.items()
            ],
        }

    if kind == "list":
        value = json_safe(value) if value is not None else []
        item_value = get_default_value(block.child_block)
        return {
            "kind": "list",
            "path": path,
            "label": label,
            "itemValue": item_value,
            "itemField": get_editor_field(block.child_block, item_value),
            "items": [
                {
                    "value": item,
                    "field": get_editor_field(block.child_block, item),
                }
                for item in value
            ],
        }

    if kind in ("richtext", "plain_text"):
        return {
            "kind": "editable",
            "path": path,
            "label": label,
            "mode": "plain_text" if kind == "plain_text" else "richtext",
            "value": value or "",
        }

    field = {
        "kind": "control",
        "path": path,
        "label": label,
        "controlType": kind,
        "value": value,
    }
    if kind == "choice":
        field["options"] = get_choice_options(block)
    return field


def get_field_kind(block):
    if isinstance(block, blocks.StructBlock):
        return "struct"
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
    return "unknown"


def get_default_value(block):
    kind = get_field_kind(block)

    if kind == "struct":
        return {
            name: get_default_value(child_block)
            for name, child_block in block.child_blocks.items()
        }
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

    return json_safe(block.get_prep_value(block.get_default()))


def get_choice_options(block):
    return [
        {"value": value, "label": str(label)}
        for value, label in block.field.choices
    ]


def json_safe(value):
    return json.loads(json.dumps(value, default=str))
