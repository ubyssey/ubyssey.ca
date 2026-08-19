from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock

class ImageBlock(blocks.StructBlock):

    image = ImageChooserBlock(
        required=True,
    )
    click_to_enlarge = blocks.BooleanBlock(
        required=False,
        default=True,
        help_text="Leaving this checked means readers will be able to click on the image to see it enlarged",
    )
    style = blocks.ChoiceBlock(
        choices=[
            ('default', 'Default'),
            ('left', 'Left'),
            ('right', 'Right'),   
        ],
        default='default',
    )
    width = blocks.ChoiceBlock(
        choices=[
            ('full-width', 'Full width'),
            ('full', 'Wide'),
            ('large', 'Normal'),
            ('medium', 'Medium'),
            ('small', 'Small'),
        ],
        default='full',
    )
    caption = blocks.RichTextBlock(required=False)
    credit = blocks.CharBlock(
        max_length=255,
        required=False,
    )

    alt_text = blocks.CharBlock(
        max_length=255,
        required=False,
        help_text="For accessibility to screen reader users, enter a description of this image. Included any relevant text inside the image."
    )

    class Meta:
        template = 'images/stream_blocks/image_block.html'
        icon = 'image'

class AltTextImageBlock(blocks.StructBlock):
    image = ImageChooserBlock(
        required=True,
    )

    alt_text = blocks.CharBlock(
        max_length=255,
        required=False,
        help_text="For accessibility to screen reader users, enter a description of this image. Included any relevant text inside the image."
    )

    class Meta:
        template = 'images/stream_blocks/image_block.html'
        icon = 'image'

class ReducedImageBlock(blocks.StructBlock):

    image = ImageChooserBlock(
        required=True,
    )

    alt_text = blocks.CharBlock(
        max_length=255,
        required=False,
        help_text="For accessibility to screen reader users, enter a description of this image. Included any relevant text inside the image."
    )

    credit = blocks.CharBlock(
        max_length=255,
        required=False,
    )

    class Meta:
        template = 'images/stream_blocks/image_block.html'
        icon = 'image'

class CaptionedImageBlock(ReducedImageBlock):
    caption = blocks.RichTextBlock(required=False)

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context['click_to_enlarge'] = True
        return context
