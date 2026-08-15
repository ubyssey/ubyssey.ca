# This file creates the public version of the Page, so annotations like comments are editor only

# Removes editor only data from StreamField values
# ie footnotes and comments from html
# The prosemirror classes in article templates are necessary unless we maintain a duplicate version of the article html

import re

# Regex to strip out editor only annotations
EDITOR_NOTE_EMPTY_ANCHOR_RE = re.compile(r'<span\b(?=[^>]*\bdata-footnote-anchor=(?:"true"|\'true\'))[^>]*>.*?</span>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ANCHOR_RE = re.compile(r'<(?:span|mark)\b(?=[^>]*\bdata-(?:comment-thread|footnote)-id=)[^>]*>(.*?)</(?:span|mark)>', re.IGNORECASE | re.DOTALL)
EDITOR_NOTE_ATTR_RE = re.compile(r'\sdata-(?:comment-(?:thread-id|comments|pending|resolved)|footnote-(?:id|text|anchor))=("[^"]*"|\'[^\']*\'|[^\s>]+)', re.IGNORECASE)
# Subs <br> for <br/> (weird YJS behaviour) otherwise crashes Wagtail
BR_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
# Placing footnotes inside links broke them in public version -> possible issue for other elements too
ADJACENT_LINK_RE = re.compile(r'<a\b(?P<attrs>[^>]*)>(?P<left>.*?)</a>\s*<a\b(?P=attrs)>(?P<right>.*?)</a>', re.IGNORECASE | re.DOTALL)


# Creates public version of page
def generate_public_streamfield(value):
    if isinstance(value, list):
        return [generate_public_streamfield(item) for item in value]
    if isinstance(value, dict):
        return {
            key: generate_public_streamfield(child_value)
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
