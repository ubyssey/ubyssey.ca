# Removes editor only data from StreamField values
# ie footnotes and comments from html

# The prosemirror classes in article templates are necessary unless we duplicate the article html completely
# (actually maybe we could strip it dynamically before we send it but that sounds terrible)

import re
from wagtail.documents import get_document_model


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


# Good luck
EDITOR_NOTE_EMPTY_ANCHOR_RE = re.compile(r'<span\b(?=[^>]*\bdata-footnote-anchor=(?:"true"|\'true\'))[^>]*>.*?</span>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ANCHOR_RE = re.compile(r'<(?:span|mark)\b(?=[^>]*\bdata-(?:comment-thread|footnote)-id=)[^>]*>(.*?)</(?:span|mark)>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ATTR_RE = re.compile(r'\sdata-(?:comment-(?:thread-id|comments|pending|resolved)|footnote-(?:id|text|anchor))=("[^"]*"|\'[^\']*\'|[^\s>]+)', re.IGNORECASE)
# Placing footnotes inside links broke them in public version -> possible issue for other elements too
ADJACENT_LINK_RE = re.compile(r'<a\b(?P<attrs>[^>]*)>(?P<left>.*?)</a>\s*<a\b(?P=attrs)>(?P<right>.*?)</a>', re.IGNORECASE | re.DOTALL)


# Sanitizes StreamField values on unsaved preview refresh (when things are likely not properly inputted yet)
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
