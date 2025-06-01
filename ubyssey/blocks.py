from wagtail import blocks

class LandingStreamInfo(blocks.StructBlock):

    richtext = blocks.RichTextBlock(required=True)
    hide_from_desktop = blocks.BooleanBlock(required=False)

    class Meta:
        template = 'objects/landing-stream__info.html'
        icon = 'info-circle'