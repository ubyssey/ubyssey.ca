from wagtail.blocks import StructBlock, RichTextBlock, RawHTMLBlock


class LiveblogHeader(StructBlock):
    def stageValue(self, value):
        return None

class LiveblogSummary(StructBlock):
    richtext = RichTextBlock(required=True)

    def stageValue(self, value):
        return {"richtext": RichTextBlock().to_python(value['richtext']).__html__()}

class LiveblogRawHTML(StructBlock):
    raw_html = RawHTMLBlock(required=True)

    def stageValue(self, value):
        return value