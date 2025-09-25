from wagtail import blocks

from wagtail.documents.blocks import DocumentChooserBlock

from django.utils.safestring import mark_safe
from django.template.loader import render_to_string
from django.db import models

from ubyssey.validators import validate_youtube_url
from images import blocks as image_blocks

# Storystream views
class StorystreamStructBlock(blocks.StructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('large-headline', 'Large headline'),
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

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        # Rather than the "normal" template logic, we look at our self.template variable
        block_template = value.get('template')
        if block_template != '':
            if block_template == 'profile':
                new_context['style'] = 'o-article_storystream_profile'
                template = 'article/objects/storystream_views/featured.html'
            else:
                template = 'article/objects/storystream_views/' + block_template + '.html'
        else:
            return self.render_basic(value, context=context) # Wagtail's default for when 

        return mark_safe(render_to_string(template, new_context))
    
class StorystreamFeaturedImage(StorystreamStructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('large-headline', 'Large headline'),
            ('featured', 'Featured (Featured media above, Headline below'),
            ('indent', 'Indent (Headline above, lede + featured media below'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        image_context = parent_context
        featured_media=parent_context["article"].featured_media.all()
        if len(featured_media) > 0:
            if featured_media[0].image:
                image_context["image"] = featured_media[0].image
            if featured_media[0].alt_text:
                image_context["alt_text"] = featured_media[0].alt_text
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/image.html', image_context))
        return context
    
    class Meta:
        icon = "image"
        label = "Use featured media image"

class StorystreamNoAttachment(StorystreamStructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('indent', 'Indent (Headline above, lede below)'),
        ],
        default='indent',
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        return context
    
    class Meta:
        icon = "cross"
        label = "No attachment (only lede)"
    
class StorystreamGallery(StorystreamStructBlock):

    images = blocks.ListBlock(
        image_blocks.ReducedImageBlock()
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (gallery above, headline below)'),
            ('indent', 'Indent (headline above, gallery below)'),
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
        label = "Image carousel"

class StorystreamRawHtml(StorystreamStructBlock):

    raw_html = blocks.RawHTMLBlock(
        label = "Raw HTML Block",
        help_text = "You can use for this for embedding stuff from other sites (like youtube videos)"
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (embed above, headline below)'),
            ('indent', 'Indent (headline above, embed below)'),
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
            ('featured', 'Featured (embeded pdf above, headline below)'),
            ('indent', 'Indent (headline above, embeded pdf below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/pdf.html', parent_context))
        return context

    class Meta:
        icon = "doc-full"
        label = "PDF"

class StorystreamVideo(StorystreamStructBlock):

    video = blocks.URLBlock(
        max_length=500,
        null=False,
        blank=False,
        default='',
        validators=[validate_youtube_url,]
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (video above, headline below)'),
            ('indent', 'Indent (headline above, video below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        video_context = parent_context
        video_context["video"] = value["video"]
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/video.html', video_context))
        return context

    class Meta:
        icon = "media"
        label = "Video (for a different video than featured media)"


class StorystreamFeaturedVideo(StorystreamStructBlock):

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (video above, headline below)'),
            ('indent', 'Indent (headline above, video below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        video_context = parent_context
        video_context["video"] = parent_context["article"].featured_media.all()[0].video
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/video.html', video_context))
        return context

    class Meta:
        icon = "media"
        label = "Use featured media video"


class StorystreamImage(StorystreamStructBlock):

    image = image_blocks.ReducedImageBlock()

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (image above, headline below)'),
            ('profile', 'Profile (headline left, tall cut out image with dropshadow right)'),
            ('indent', 'Indent (headline above, image below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        image_context = parent_context
        image_context["image"] = value["image"]["image"]
        image_context["alt_text"] = value["image"]["alt_text"]
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/image.html', image_context))
        return context

    class Meta:
        icon = "image"
        label = "Image (for a different image than featured media)"

class StorystreamQuote(StorystreamStructBlock):

    image = image_blocks.ReducedImageBlock()

    quote = blocks.TextBlock(required=True)

    template = blocks.ChoiceBlock(
        choices=[
            ('featured', 'Featured (quote above with image as background, headline below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        quote_context = parent_context
        quote_context["quote"] = value["quote"]
        quote_context["image"] = value["image"]
        context["attachment"] = mark_safe(render_to_string('article/objects/storystream_views/storystream_attachments/quote_with_background.html', quote_context))
        return context

    class Meta:
        icon = "openquote"
        label = "Quote (for Opinons, personal essays, interviews)"
    
class StorystreamRichText(StorystreamStructBlock):

    richtext = blocks.RichTextBlock(required=True)
    template = blocks.ChoiceBlock(
        choices=[
            ('indent', 'Indent (headline above, lede + richtext below)'),
        ],
        required=True,
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["attachment"] = value["richtext"]
        return context
    
    class Meta:
        icon = "pilcrow"
        label = "Rich text (for AMS, BoG, Senate recaps)"

# StreamField

StoryStreamBlockTypes =  [
        ('featured_media', StorystreamFeaturedImage()),
        ('image', StorystreamImage()),
        ('richtext', StorystreamRichText()),
        ('no_attachment', StorystreamNoAttachment()),
        ('gallery', StorystreamGallery()),
        ('featured_video', StorystreamFeaturedVideo()),
        ('video', StorystreamVideo()),
        ('embed', StorystreamRawHtml()),
        ('pdf', StorystreamPDF()),
        ('quote', StorystreamQuote())
    ]