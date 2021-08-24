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

    def render(self, value, context=None):
        """
        According to the below stackoverflow, we need to modify this specific method in order to allow template selection
        in such a way that the block itself tracks
        https://stackoverflow.com/questions/55875597/wagtail-how-to-access-structblock-class-attribute-inside-block

        In some ways this is a proof of concept for modifiable blocks
        """

        # Rather than the "normal" template logic, we look at our self.template variable
        if self.template == 'guide-2020':
            template = 'specialfeatureslanding/blocks/guide-2020-panel-quote.html'
        else:
            template = 'specialfeatureslanding/blocks/guide-2020-panel-quote.html' #TODO better default

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))

class CustomStylingCTABlock(blocks.StructBlock):

    title = blocks.CharBlock(
        max_length=255,
        required=True,
    )
    content = blocks.RichTextBlock(
        required=True,
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
        if self.template == 'guide-2020':
            template = 'specialfeatureslanding/blocks/guide-2020-panel-quote.html'
        else:
            template = 'specialfeatureslanding/blocks/guide-2020-panel-quote.html' #TODO better default

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))
