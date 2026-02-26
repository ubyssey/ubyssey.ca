from wagtail.blocks import StructBlock, RichTextBlock, RawHTMLBlock


class LiveblogHeader(StructBlock):
    pass

class LiveblogSummary(StructBlock):
    richtext = RichTextBlock(required=True)

class LiveblogRawHTML(StructBlock):
    raw_html = RawHTMLBlock(required=True)