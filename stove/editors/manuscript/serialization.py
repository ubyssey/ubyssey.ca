# This file creates the public version of the Page, so annotations like comments are editor only

# Removes editor only data from StreamField values
# ie footnotes and comments from html
# The prosemirror classes in article templates are necessary unless we maintain a duplicate version of the article html

import re
from bs4 import BeautifulSoup


def strip_editor_annotations(value):
    soup = BeautifulSoup(value, "html.parser")

    for element in soup.find_all(True):
        if not element.attrs:
            continue
        if str(element.get("data-footnote-anchor", "")).lower() == "true":
            element.decompose()

    for element in soup.find_all(["span", "mark"]):
        if any(attribute in element.attrs for attribute in (
            "data-comment-thread-id",
            "data-suggestion-thread-id",
            "data-footnote-id",
        )):
            element.unwrap()

    for element in soup.find_all(True):
        for attribute in list(element.attrs):
            if attribute.lower().startswith(("data-comment-", "data-suggestion-", "data-footnote-")):
                del element.attrs[attribute]

    return "".join(str(child) for child in soup.contents)


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
    if isinstance(value, str) and ("data-comment-" in value or "data-suggestion-" in value or "data-footnote-" in value):
        stripped = strip_editor_annotations(value)
        previous = None
        while previous != stripped:
            previous = stripped
            stripped = ADJACENT_LINK_RE.sub(r'<a\g<attrs>>\g<left>\g<right></a>', stripped)
        return stripped
    return value
