from wagtail.blocks import StructBlock, RichTextBlock


class LiveblogHeader(StructBlock):
    pass

class LiveblogSummary(StructBlock):
    richtext = RichTextBlock(required=True)