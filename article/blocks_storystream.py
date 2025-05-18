from wagtail import blocks
from images import blocks as image_blocks
from wagtail.documents.blocks import DocumentChooserBlock

from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

# Storystream views
class StorystreamStructBlock(blocks.StructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('article/objects/storystream_views/large-headline.html', 'Large headline'),
        ],
        required=True,
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
            template = block_template
        else:
            return self.render_basic(value, context=context) # Wagtail's default for when 

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))
    
class StorystreamFeaturedImage(StorystreamStructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('article/objects/storystream_views/large-headline.html', 'Standard (Large headline left, small featured media right)'),
            ('article/objects/storystream_views/featured.html', 'Featured (Featured media above, Headline below'),
            ('article/objects/storystream_views/indent.html', 'Indent (Headline above, lede + featured media below'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/image.html', parent_context))
        return context
    
    class Meta:
        icon = "image"
    
class StorystreamGallery(StorystreamStructBlock):

    images = blocks.ListBlock(
        image_blocks.ReducedImageBlock()
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('article/objects/storystream_views/featured.html', 'Featured (gallery above, headline below)'),
            ('article/objects/storystream_views/indent.html', 'Indent (headline above, gallery below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        gallery_context = parent_context
        gallery_context["indicators"] = "false"
        gallery_context["nocaption"] = "true"
        context["attachment"] = mark_safe(render_to_string('article/stream_blocks/gallery_block.html', gallery_context))
        return context

    class Meta:
        icon = "image"
        label = "Carousel"

class StorystreamRawHtml(StorystreamStructBlock):

    raw_html = blocks.RawHTMLBlock(
        label = "Raw HTML Block",
        help_text = "You can use for this for embedding stuff from other sites (like youtube videos)"
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('article/objects/storystream_views/featured.html', 'Featured (embed above, headline below)'),
            ('article/objects/storystream_views/indent.html', 'Indent (headline above, embed below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["attachment"] = value["raw_html"]
        return context

    class Meta:
        icon = "code"

class StorystreamPDF(StorystreamStructBlock):

    pdf = DocumentChooserBlock(required=True, help_text="File format: .pdf")

    template = blocks.ChoiceBlock(
        choices=[
            ('article/objects/storystream_views/featured.html', 'Featured (embeded pdf above, headline below)'),
            ('article/objects/storystream_views/indent.html', 'Indent (headline above, embeded pdf below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/pdf.html', parent_context))
        return context

    class Meta:
        icon = "doc-full"