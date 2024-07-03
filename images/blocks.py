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
            ('full', 'Full'),
            ('small', 'Small'),
            ('medium', 'Medium'),
            ('large', 'Large'),
        ],
        default='full',
    )
    caption = blocks.CharBlock(
        max_length=255,
        required=False,
    )
    credit = blocks.CharBlock(
        max_length=255,
        required=False,
    )

    class Meta:
        template = 'images/stream_blocks/image_block.html'
        icon = 'image'
