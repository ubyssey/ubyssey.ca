# Converts YJS document to Wagtail

import json
import math
import re
from copy import deepcopy

from django.http import QueryDict
from prosemirror.model import DOMSerializer, Fragment, Schema
from prosemirror.schema.basic import schema as basic_schema
from prosemirror.schema.list import add_list_nodes
from pycrdt import Array, Doc, Map, Text, XmlElement, XmlFragment, XmlText
from wagtail.fields import StreamField


# Refer to comment_model.js
def comment_dom(mark, inline):
    attrs = mark.attrs
    comments = attrs["comments"] or []
    suggestion = comments[0].get("suggestion") if comments else None
    return ["span", {
        "data-comment-thread-id": attrs["threadId"] or "",
        "data-comment-comments": json.dumps(comments, ensure_ascii=False, separators=(",", ":")),
        "data-comment-pending": "true" if attrs["pending"] else "false",
        "data-comment-resolved": "true" if attrs["resolved"] else "false",
        "data-comment-suggestion": attrs["suggestionPart"] or suggestion or "",
        "data-comment-suggestion-part": attrs["suggestionPart"] or "",
    }, 0]


# Refer to comment_model.js (mayhaps separate at some point)
def suggestion_dom(mark, inline):
    attrs = mark.attrs
    comments = attrs["comments"] or []
    suggestion = comments[0].get("suggestion") if comments else None
    return ["span", {
        "data-suggestion-thread-id": attrs["threadId"] or "",
        "data-suggestion-comments": json.dumps(comments, ensure_ascii=False, separators=(",", ":")),
        "data-suggestion-pending": "true" if attrs["pending"] else "false",
        "data-suggestion-resolved": "true" if attrs["resolved"] else "false",
        "data-suggestion-part": attrs["suggestionPart"] or suggestion or "",
    }, 0]


# TODO - investigate why comments/suggestions share the same attributes
ANNOTATION_ATTRS = {
    "threadId": {"default": None},
    "comments": {"default": []},
    "suggestionPart": {"default": None},
    "pending": {"default": False},
    "resolved": {"default": False},
}

# Refer to stream_schema.js and richtext/schema.js
RICH_TEXT_SCHEMA = Schema({
    "nodes": add_list_nodes(basic_schema.spec["nodes"], "paragraph block*", "block"),
    "marks": {
        **basic_schema.spec["marks"],
        "underline": {"toDOM": lambda mark, inline: ["u", 0]},
        "comment": {"attrs": ANNOTATION_ATTRS, "inclusive": False, "toDOM": comment_dom},
        "suggestion": {"attrs": ANNOTATION_ATTRS, "inclusive": False, "toDOM": suggestion_dom},
        "footnote": {
            "inclusive": False,
            "attrs": {
                "footnoteId": {"default": None},
                "text": {"default": ""},
                "anchor": {"default": False},
            },
            "toDOM": lambda mark, inline: ["span", {
                "data-footnote-id": mark.attrs["footnoteId"] or "",
                "data-footnote-text": mark.attrs["text"] or "",
                "data-footnote-anchor": "true" if mark.attrs["anchor"] else "false",
            }, 0],
        },
    },
})


def yjs_fragment_to_pm_doc(fragment):
    return {"type": "doc", "content": yjs_children_to_pm_nodes(fragment)}


def yjs_children_to_pm_nodes(parent):
    nodes = []
    for child in parent.children:
        if isinstance(child, XmlText):
            for text, attributes in child.diff():
                node = {"type": "text", "text": text}
                if attributes:
                    # y-prosemirror adds a suffix to overlapping marks to make them unique, so we remove for wagtail here
                    node["marks"] = [
                        {
                            "type": re.sub(r"--[a-zA-Z0-9+/=]{8}$", "", name),
                            "attrs": normalize_numbers(attrs),
                        }
                        for name, attrs in attributes.items()
                    ]
                nodes.append(node)
        elif isinstance(child, XmlElement):
            node = {"type": child.tag}
            attrs = normalize_numbers(dict(child.attributes))
            if attrs:
                node["attrs"] = attrs
            content = yjs_children_to_pm_nodes(child)
            if content:
                node["content"] = content
            nodes.append(node)
        else:
            raise ValueError(f"Unexpected Yjs node: {type(child).__name__}")
    return nodes


def pm_doc_to_stream_value(pm_doc):
    return [
        pm_stream_block_to_wagtail_block(node)
        for node in pm_doc.get("content", [])
        if node["type"] == "stream_block"
    ]


def pm_stream_block_to_wagtail_block(node):
    attrs = node.get("attrs", {})
    block = {
        "type": attrs.get("blockType") or "unknown",
        "value": deepcopy(attrs.get("originalValue")),
    }

    if attrs.get("id"):
        block["id"] = attrs["id"]

    comments = attrs.get("blockComments")
    block_comments = [
        thread for thread in (comments if isinstance(comments, list) else [])
        if not thread.get("pending")
        and isinstance(thread.get("comments"), list)
        and thread["comments"]
    ]
    if block_comments:
        block["comments"] = deepcopy(block_comments)

    for field in node.get("content", []):
        path = field.get("attrs", {}).get("path") or []
        value = field_value(field, get_value_at_path(block["value"], path))
        block["value"] = set_field_value(block["value"], path, value)
    return block


def field_value(node, original_value):
    attrs = node.get("attrs", {})
    if node["type"] == "editable_field":
        return editable_field_value(node, attrs.get("mode", "richtext"))
    if node["type"] == "control_field":
        return control_field_value(attrs, original_value)
    if node["type"] == "struct_field":
        return struct_field_value(node)
    if node["type"] == "list_field":
        return list_field_value(node)
    if node["type"] == "stream_field":
        return stream_field_value(node)
    return original_value


def struct_field_value(node):
    value = deepcopy(node.get("attrs", {}).get("originalValue"))
    for child in node.get("content", []):
        path = child.get("attrs", {}).get("path") or []
        original_value = get_value_at_path(value, path)
        value = set_field_value(value, path, field_value(child, original_value))
    return value


def list_field_value(node):
    values = []
    for item in node.get("content", []):
        if item["type"] != "list_item":
            continue
        value = deepcopy(item.get("attrs", {}).get("originalValue"))
        for field in item.get("content", []):
            path = field.get("attrs", {}).get("path") or []
            content = field_value(field, get_value_at_path(value, path))
            value = set_field_value(value, path, content)
        values.append(value)
    return values


def stream_field_value(node):
    values = []
    for item in node.get("content", []):
        if item["type"] != "stream_item":
            continue
        attrs = item.get("attrs", {})
        value = deepcopy(attrs.get("originalValue"))
        for field in item.get("content", []):
            path = field.get("attrs", {}).get("path") or []
            original_value = get_value_at_path(value, path)
            value = set_field_value(value, path, field_value(field, original_value))
        stream_item = {"type": attrs.get("blockType") or "unknown", "value": value}
        if attrs.get("id"):
            stream_item["id"] = attrs["id"]
        values.append(stream_item)
    return values


def text_content(node):
    if node["type"] == "text":
        return node["text"]
    return "".join(text_content(child) for child in node.get("content", []))


def editable_field_value(node, mode="richtext"):
    if mode == "plain_text":
        return "\n\n".join(text_content(block) for block in node.get("content", []))

    rich_text_nodes = [
        RICH_TEXT_SCHEMA.node_from_json(block) for block in node.get("content", [])
    ]

    if not any(block.text_content.strip() for block in rich_text_nodes):
        return ""
    fragment = Fragment.from_array(rich_text_nodes)
    return str(DOMSerializer.from_schema(RICH_TEXT_SCHEMA).serialize_fragment(fragment))


def control_field_value(attrs, original_value):
    value = attrs.get("value")
    control_type = attrs.get("controlType") or "text"
    if control_type == "boolean":
        # Sketchy JS logic that I'm keeping for now
        value = True if isinstance(value, (list, dict)) else bool(value)
    if control_type in ("image", "document", "page") and value == "":
        value = None
    if control_type == "number":
        if value == "" or value is None:
            value = None
        else:
            try:
                value = float(value.strip() or "0") if isinstance(value, str) else float(value)
                value = int(value) if math.isfinite(value) and value.is_integer() else value
                if not math.isfinite(value):
                    value = None
            except (TypeError, ValueError):
                value = None
    return [value] if isinstance(original_value, list) else value


def set_field_value(root, path, value):
    if not path:
        return value
    root = root if isinstance(root, (dict, list)) else {}
    current = root

    for key in path[:-1]:
        child = get_value_at_path(current, [key])
        if not isinstance(child, (dict, list)):
            child = {}
            set_field_value(current, [key], child)
        current = child
    key = path[-1]

    if isinstance(current, list):
        key = int(key)
        current.extend([None] * max(0, key + 1 - len(current)))
    current[key] = value
    return root


def get_value_at_path(root, path):
    current = root
    for key in path:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list):
            index = int(key)
            current = current[index] if 0 <= index < len(current) else None
        else:
            return None
    return current


def yjs_document_to_wagtail_form_data(page, document):
    ydoc = Doc()
    ydoc.apply_update(bytes(document))
    data = QueryDict(mutable=True)
    for field in page._meta.get_fields():
        if isinstance(field, StreamField) and field.name in ydoc:
            fragment = ydoc.get(field.name, type=XmlFragment)
            value = pm_doc_to_stream_value(yjs_fragment_to_pm_doc(fragment))
            data[f"stream_{field.name}"] = json.dumps(value, ensure_ascii=False)

    metadata = ydoc.get("metadata", type=Map)
    for key, value in metadata.items():
        if not key.startswith("field:"):
            continue
        name = key[len("field:"):]
        if isinstance(value, Text):
            value = str(value)
        elif isinstance(value, (Array, Map)):
            value = value.to_py()
        value = normalize_numbers(value)
        if isinstance(value, list):
            data.setlist(name, [str(item) for item in value])
        elif isinstance(value, bool):
            data[name] = "on" if value else ""
        else:
            data[name] = "" if value is None else str(value)

    authors = metadata.get("articleAuthors")
    if isinstance(authors, Array):
        authors = authors.to_py()
    authors = normalize_numbers(authors)
    if isinstance(authors, list):
        data.setlist("article_authors-author", [str(row.get("authorId") or "") for row in authors])
        data.setlist("article_authors-role", [row.get("role") or "author" for row in authors])
    return data


def normalize_numbers(value):
    # pycrdt reads JS numbers as floats
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {key: normalize_numbers(child) for key, child in value.items()}
    if isinstance(value, list):
        return [normalize_numbers(child) for child in value]
    return value
