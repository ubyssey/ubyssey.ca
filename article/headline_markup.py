"""Render the limited inline formatting used in editorial headlines."""

from html import escape, unescape
from html.parser import HTMLParser


INLINE_TAGS = frozenset({"b", "br", "em", "i", "strong", "sub", "sup", "u"})


class _HeadlineParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.open_tags = []

    def handle_data(self, data):
        self.parts.append(escape(data))

    def handle_starttag(self, tag, attrs):
        if tag in INLINE_TAGS:
            # Rebuild allowed tags without any editor-supplied attributes.
            self.parts.append(f"<{tag}>")
            if tag != "br":
                self.open_tags.append(tag)
        else:
            self.parts.append(escape(self.get_starttag_text() or f"<{tag}>"))

    def handle_startendtag(self, tag, attrs):
        if tag in INLINE_TAGS:
            self.parts.append("<br>" if tag == "br" else f"<{tag}></{tag}>")
        else:
            self.parts.append(escape(self.get_starttag_text() or f"<{tag}/>"))

    def handle_endtag(self, tag):
        if tag in self.open_tags:
            while self.open_tags:
                closing = self.open_tags.pop()
                self.parts.append(f"</{closing}>")
                if closing == tag:
                    break
        else:
            self.parts.append(escape(f"</{tag}>"))

    def handle_comment(self, data):
        self.parts.append(escape(f"<!--{data}-->"))

    def handle_decl(self, decl):
        self.parts.append(escape(f"<!{decl}>"))


def render_headline_markup(value):
    """Decode stored entities, then keep only safe, balanced inline tags."""
    parser = _HeadlineParser()
    parser.feed(unescape(str(value)))
    parser.close()
    while parser.open_tags:
        parser.parts.append(f"</{parser.open_tags.pop()}>")
    return "".join(parser.parts)
