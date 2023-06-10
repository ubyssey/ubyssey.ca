from wagtail.core import blocks
from wagtail.core.blocks import field_block
from images import blocks as image_blocks
from videos import blocks as video_blocks

class PullQuoteBlock(blocks.StructBlock):
    content = blocks.CharBlock(required=False)
    source =  blocks.CharBlock(required=False)

    class Meta:
        template = 'article/stream_blocks/quote.html',
        icon = "openquote"

class ChooseSideBlock(blocks.ChoiceBlock):
    choices=[('left', 'Left'),('right', 'Right'),]
    default="right"

class VisualEssayBlock(blocks.StructBlock):
    content = blocks.StreamBlock([
        ('rich_text', blocks.StructBlock(
            [
                ('block', blocks.RichTextBlock(                                
                    label="Rich Text Block",
                    help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
                )),
                ('side',ChooseSideBlock()),
            ], icon = "doc-full"
        )),
        ('image', blocks.StructBlock(
            [
                ('block', image_blocks.ImageBlock()),
                ('side',ChooseSideBlock()),
            ], icon = "image"
        )),
        ('video', blocks.StructBlock(
            [
                ('block', video_blocks.OneOffVideoBlock(
                    label = "Credited/Captioned One-Off Video",
                    help_text = "Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block."
                )),
                ('side',ChooseSideBlock()),
            ], icon = "media"
        )),
        ('raw_html', blocks.StructBlock(
            [
                ('block', blocks.RawHTMLBlock(
                    label = "Raw HTML Block",
                    help_text = "WARNING: DO NOT use this unless you really know what you're doing!"
                )),
                ('side',ChooseSideBlock()),
            ], icon = "code"
        )),
        ('quote', blocks.StructBlock(
            [
                ('block', PullQuoteBlock()),
                ('side',ChooseSideBlock()),
            ], icon = "openquote"
        )),
    ])

    class Meta:
        template = 'article/stream_blocks/visual-essay.html'
