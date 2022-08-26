from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from wagtail.core import blocks
from wagtail.images.blocks import ImageChooserBlock

class QuoteBlock(blocks.StructBlock):

    quote = blocks.RichTextBlock(
        required=False,
    )
    source = blocks.CharBlock(
        max_length=255,
        required=False,
    )
    image = ImageChooserBlock(
        required=True,
    )
    template = blocks.ChoiceBlock(
        choices=[
            ('guide-2020', '\"Guide 2020\"-Style Panel Quote'),
        ],
    )
    class_name = blocks.CharBlock(
        max_length=255,
        required=True,
        default='panel-quote __1'
    )

    def render(self, value, context=None):
        """
        According to the below stackoverflow, we need to modify this specific method in order to allow template selection
        in such a way that the block itself tracks
        https://stackoverflow.com/questions/55875597/wagtail-how-to-access-structblock-class-attribute-inside-block

        In some ways this is a proof of concept for modifiable blocks
        """

        # Rather than the "normal" template logic, we look at our self.template variable
        block_template = value.get('template')
        if block_template == 'guide-2020':
            template = 'specialfeaturelanding/blocks/guide-2020-panel-quote.html'
        else:
            template = 'specialfeaturelanding/blocks/guide-2020-panel-quote.html' #TODO better default

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))

class GuideBannerBlock(blocks.StructBlock):
    template = 'specialfeaturelanding/blocks/guide_banner_block.html'

    image = ImageChooserBlock(
        required=True,
    )
    title_intro = blocks.CharBlock(
        max_length=255,
        required=True,
        default='The Ubyssey presents'
    )
    title = blocks.CharBlock(
        max_length=255,
        required=True,
        default='Guide To UBC'
    )
    credit = blocks.CharBlock(
        max_length=255,
        required=True,
        default='Author Name Goes Here'
    )

class CustomStylingCTABlock(blocks.StructBlock):

    title = blocks.CharBlock(
        max_length=255,
        required=True,
    )
    richcontent = blocks.RichTextBlock(
        required=False,
    )
    htmlcontent = blocks.RawHTMLBlock(
        required=False,
    )
    use_richtext = blocks.BooleanBlock(
        default=False,
        required=False,
    )
    link = blocks.PageChooserBlock(
        required=True,
    )
    link_text = blocks.CharBlock(
        max_length=255,
        required=True,
    )
    class_name = blocks.CharBlock(
        max_length=255,
        required=True,
    )
    template = blocks.ChoiceBlock(
        required=True,
        choices=[
            ('guide-2020', '\"Guide 2020\"-Style CTA'),
        ],
    )
    
    def render(self, value, context=None):
        """
        According to the below stackoverflow, we need to modify this specific method in order to allow template selection
        in such a way that the block itself tracks
        https://stackoverflow.com/questions/55875597/wagtail-how-to-access-structblock-class-attribute-inside-block

        In some ways this is a proof of concept for modifiable blocks
        """

        # Rather than the "normal" template logic, we look at our self.template variable
        block_template = value.get('template')
        if block_template == 'guide-2020':
            template = 'specialfeaturelanding/blocks/guide-2020-cta.html'
        else:
            template = 'specialfeaturelanding/blocks/guide-2020-cta.html' #TODO better default

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))

class GraphicalMenuItemBlock(blocks.StructBlock):
    
    template = 'specialfeaturelanding/blocks/graphical-menu-item.html'
    
    div_class_name = blocks.CharBlock(
        max_length=255,
        required=True,
        default='box'
    )

    img_class_name = blocks.CharBlock(
        max_length=255,
        required=True,
        default='photo_cover'
    )

    link = blocks.URLBlock(
        required=True,
    )

    image = ImageChooserBlock(
        required=True,
    )

    width = blocks.IntegerBlock(
        required = False
    )

    height = blocks.IntegerBlock(
        required = False
    )

class TextDivBlock(blocks.StructBlock):

    template = 'specialfeaturelanding/blocks/graphical-menu-item.html'

    class_name = blocks.CharBlock(
        max_length=255,
        required=True,
        default='class'
    )

    text = blocks.CharBlock(
        max_length=255,
        required=True,
        default='text'
    )
