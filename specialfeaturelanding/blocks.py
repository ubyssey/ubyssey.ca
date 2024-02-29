from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock

TEMPLATE_DIRECTORY = "specialfeaturelanding/blocks/"

class TemplateSelectStructBlock(blocks.StructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
        ],
        required=False,
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
        if block_template != '':
            template = TEMPLATE_DIRECTORY + block_template
        else:
            return self.render_basic(value, context=context) # Wagtail's default for when 

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))


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

class NoteWithHeaderBlock(TemplateSelectStructBlock):

    title = blocks.CharBlock()
    rich_text = blocks.RichTextBlock()
    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-editors-note.html', 'guide-2021-editors-note.html'),
            ('guide-2021-land-acknowledgement.html', 'guide-2021-land-acknowledgement.html'),
        ],
        required=False,
    )

class EditorCreditBlock(TemplateSelectStructBlock):

    role = blocks.CharBlock()
    name = blocks.CharBlock()
    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-editor-credit.html', 'Guide 2021 Style'),
            ('magazine-2024-editor-credit.html', 'Magazine 2024 Style'),
        ],
        required=False,
    )

class EditorialStreamBlock(blocks.StreamBlock):

    raw_html = blocks.RawHTMLBlock()
    rich_text = blocks.RichTextBlock()
    editor_credit = EditorCreditBlock()

class EditorialBlock(TemplateSelectStructBlock):

    stream = EditorialStreamBlock()

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-editorial-stream.html', 'Guide 2021 Style'),
            ('magazine-2024-editorial-stream.html', 'Magazine 2024 Style'),
        ],
        required=False,
    )

class BannerBlock(TemplateSelectStructBlock):
    class_selector = blocks.CharBlock(
        required=False,
    )
    image = ImageChooserBlock(
        required=False,
    )
    title1 = blocks.CharBlock(
        required=False,
    )
    title2 = blocks.CharBlock(
        required=False,
    )
    credit = blocks.CharBlock(
        required=False,
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-banner.html', 'guide-2021-banner.html'),
            ('textless_banner_block.html','textless_banner_block.html'),
            ('magazine-2024-banner.html','magazine-2024-banner.html'),
        ],
        required=False,
    )

class GraphicalMenuItemBlock(TemplateSelectStructBlock):
  

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

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-graphical-menu-item.html', 'guide-2021-graphical-menu-item.html'),
        ],
        required=False,
    )

class GraphicalMenuStreamBlock(blocks.StreamBlock):
    raw_html = blocks.RawHTMLBlock()
    rich_text = blocks.RichTextBlock()
    graphical_menu_item = GraphicalMenuItemBlock()

class GraphicalMenuBlock(TemplateSelectStructBlock):
    stream = GraphicalMenuStreamBlock()

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('guide-2021-graphical-menu.html', 'guide-2021-graphical-menu.html'),
        ],
        required=False,
    )

class ChildArticlesBlock(TemplateSelectStructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('guide-2021-child-articles.html', 'Guide 2021 Style'),
            ('magazine-2024-child-articles.html', 'Magazine 2024 Style'),
            ('magazine-2024-table-of-contents.html', 'Magazine 2024 Table of Contents Style'),
        ],
        required=True,
    )

class RenditionBlock(TemplateSelectStructBlock):
    image = ImageChooserBlock()

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('rendition-fill-1200x1000.html', 'rendition-fill-1200x1000.html'),
        ],
        required=False,
    )
class CardBlock(TemplateSelectStructBlock):
    """Card Block for magazine 2023: Title, Credit, Image, URL Link"""
    
    class_name = blocks.CharBlock(
        required = True,
    )

    card_title = blocks.CharBlock(
        required=True, 
        help_text='Add your title'
    )
    card_credit = blocks.CharBlock(
        required=True, 
        help_text='Credit Author'
    )
    card_image = ImageChooserBlock(
        required=True,
    )

    card_page = blocks.PageChooserBlock(
        required = True,
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('mag_2023_card.html','mag_2023_card.html'), 
        ],
        required=False,
    )

class FlexStream(blocks.StreamBlock):
    raw_html = blocks.RawHTMLBlock()
    rich_text = blocks.RichTextBlock()
    image = ImageChooserBlock()
    rendition = RenditionBlock()
    card = CardBlock()

class DivStreamBlock(TemplateSelectStructBlock):
    class_selector = blocks.CharBlock()    
    stream = FlexStream()

    template = blocks.ChoiceBlock(
        choices=[
            ('', 'Wagtail default'),
            ('2022-div-stream-block.html', '2022-div-stream-block.html'),
        ],
        required=False,
    )

