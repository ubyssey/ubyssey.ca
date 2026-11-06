# Wagtail has a different version of the document, without the annotations (for readers) so we need a way to merge them together
# ideally minimizing the number of lost annotations though it would be great if people mostly used Stove

import re
from copy import deepcopy
from difflib import SequenceMatcher
from bs4 import BeautifulSoup, NavigableString, Tag

from .serialization import generate_public_streamfield


# TODO Should take directly from the schema
ANNOTATION_IDS = (
    "data-comment-thread-id",
    "data-suggestion-thread-id",
    "data-footnote-id",
)


# merge Wagtail version into Stove while maintaining annotations as much as possible
#   editor is Stoves saved version with annotations
#   old_public is public version (without annotations for readers) generated from Stove
#   new_public is the current Wagtail version
def merge_wagtail_value(editor, old_public, new_public):
    if old_public == new_public:
        return editor

    if all(isinstance(value, dict) for value in (editor, old_public, new_public)):
        # streamfield blocks have both type and value
        if "type" in old_public and "value" in old_public:
            if (old_public.get("id") != new_public.get("id") or old_public.get("type") != new_public.get("type")):
                return new_public

        # walk the dict
        merged = {
            key: merge_wagtail_value(editor[key], old_public[key], value)
            if key in editor and key in old_public else value
            for key, value in new_public.items()
        }

        return merged

    if all(isinstance(value, list) for value in (editor, old_public, new_public)):
        # List positions can change so identify by id if possible
        if (
            all(isinstance(item, dict) and item.get("id") for item in editor + old_public + new_public)
            and all(len({item["id"] for item in items}) == len(items) for items in (editor, old_public, new_public))
        ):
            editor_by_id = {item["id"]: item for item in editor}
            old_by_id = {item["id"]: item for item in old_public}

            return [
                merge_wagtail_value(editor_by_id[item["id"]], old_by_id[item["id"]], item)
                if item["id"] in editor_by_id and item["id"] in old_by_id else item
                for item in new_public
            ]

        # If no ID, maintain only if matching item, otherwise replace with Wagtail
        if len(editor) == len(old_public):
            merged = []
            for item in new_public:
                matches = [index for index, old in enumerate(old_public) if old == item]
                if len(matches) == 1 and new_public.count(item) == 1:
                    merged.append(editor[matches[0]])
                else:
                    merged.append(item)
            return merged
        return new_public

    # Check if contains annotated HTML
    if all(isinstance(value, str) for value in (editor, old_public, new_public)):
        if any(attribute in editor for attribute in ANNOTATION_IDS):
            return merge_annotated_html(editor, old_public, new_public)
    return new_public


def merge_annotated_html(editor_html, old_html, new_html):
    editor_soup = BeautifulSoup(editor_html, "html.parser")
    old_soup = BeautifulSoup(old_html, "html.parser")
    new_soup = BeautifulSoup(new_html, "html.parser")
    old_text = old_soup.get_text()
    new_text = new_soup.get_text()
    annotations = []
    text_parts = []
    position = 0

    # Records where annotations are
    def collect(node):
        nonlocal position
        # Content within string
        if isinstance(node, NavigableString):
            text_parts.append(str(node))
            position += len(node)

        # HTML tags
        elif isinstance(node, Tag):
            key = next(((name, node.get(name)) for name in ANNOTATION_IDS if node.get(name)), None)
            anchor = str(node.get("data-footnote-anchor", "")).lower() == "true"
            start = position

            if not anchor:
                for child in node.children:
                    collect(child)
            if key and node.name in ("span", "mark"):
                annotations.append({
                    "key": key, "start": start, "end": position,
                    "tag": node, "anchor": anchor,
                })

    for child in editor_soup.children:
        collect(child)

    # No annotations so just return
    if not annotations:
        return new_html

    # Generated Stove text doesn't match so something has probably gone wrong
    if "".join(text_parts) != old_text:
        print("Generated public Stove text doesn't match stripped editor text")
        return new_html

    # Splits by word, then space, then punctuation, for rebuilding mapping
    old_tokens = re.findall(r"\w+|\s+|[^\w\s]", old_text)
    new_tokens = re.findall(r"\w+|\s+|[^\w\s]", new_text)
    old_offsets = [0]
    new_offsets = [0]
    for token in old_tokens:
        old_offsets.append(old_offsets[-1] + len(token))
    for token in new_tokens:
        new_offsets.append(new_offsets[-1] + len(token))
    matches = []
    for match in SequenceMatcher(None, old_tokens, new_tokens).get_matching_blocks():
        if match.size:
            matches.append((old_offsets[match.a], old_offsets[match.a + match.size], new_offsets[match.b]))

    # Map characters old range to new range
    def map_range(start, end):
        for old_start, old_end, new_start in matches:
            if old_start <= start and end <= old_end:
                text = old_text[old_start:old_end]
                if old_text.count(text) == 1 and new_text.count(text) == 1:
                    return new_start + start - old_start, new_start + end - old_start
        return None

    # Footnote anchors are a position rather than a normal range of text
    def map_anchor(position):
        before = map_range(position - 1, position) if position else None
        after = map_range(position, position + 1) if position < len(old_text) else None

        if ((not position or before is not None) and (position == len(old_text) or after is not None)):
            left = before[1] if before else 0
            right = after[0] if after else len(new_text)
            if left == right:
                return left, left

        old_left = position
        while old_left and old_text[old_left - 1].isspace():
            old_left -= 1

        old_right = position
        while old_right < len(old_text) and old_text[old_right].isspace():
            old_right += 1

        before = map_range(old_left - 1, old_left) if old_left else None
        after = map_range(old_right, old_right + 1) if old_right < len(old_text) else None
        if (old_left and before is None) or (old_right < len(old_text) and after is None):
            return None

        left = before[1] if before else 0
        right = after[0] if after else len(new_text)
        if left > right or any(not char.isspace() for char in new_text[left:right]):
            return None
        anchor = left + min(position - old_left, right - left)

        return anchor, anchor

    # Annotations can be split between multiple text nodes, so if any part is deleted we delete the whole annotation, so no half comments
    for annotation in annotations:
        annotation["range"] = (
            map_anchor(annotation["start"]) if annotation["anchor"]
            else map_range(annotation["start"], annotation["end"])
        )
    lost = {item["key"] for item in annotations if item["range"] is None}
    annotations = [item for item in annotations if item["key"] not in lost]

    # If no surviving annotations just return
    if not annotations:
        return new_html

    # Rebuilds the new HTML w annotations
    offset = 0

    # string=True only keeps text nodes not tags
    text_nodes = list(new_soup.find_all(string=True))

    for index, node in enumerate(text_nodes):
        text = str(node)
        start, end = offset, offset + len(text)
        offset = end
        boundaries = {start, end}

        for item in annotations:
            left, right = item["range"]
            if start < left < end:
                boundaries.add(left)
            if start < right < end:
                boundaries.add(right)

        boundaries = sorted(boundaries)
        replacement = []
        for left, right in zip(boundaries, boundaries[1:]):
            # Inserts footnotes
            replacement.extend(
                deepcopy(item["tag"]) for item in annotations
                if item["anchor"] and item["range"][0] == left
            )

            # Inserts text and wraps with annotations
            part = NavigableString(text[left - start:right - start])
            for item in annotations:
                if (not item["anchor"] and item["range"][0] <= left and right <= item["range"][1]):
                    wrapper = new_soup.new_tag(item["tag"].name, attrs=deepcopy(item["tag"].attrs))
                    wrapper.append(part)
                    part = wrapper
            replacement.append(part)

        # Inserts last footnote if there is one at the end
        if index == len(text_nodes) - 1:
            replacement.extend(
                deepcopy(item["tag"]) for item in annotations
                if item["anchor"] and item["range"][0] == end
            )

        # Replaces the original node with the new nodes, * means they split into a list of nodes as separate arguments
        node.replace_with(*replacement)

    merged = new_soup.decode_contents()
    public_merged = BeautifulSoup(generate_public_streamfield(merged), "html.parser")
    public_new = BeautifulSoup(new_html, "html.parser")

    if public_merged.decode_contents() != public_new.decode_contents():
        return new_html
    return merged
