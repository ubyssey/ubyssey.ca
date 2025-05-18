from wagtail import blocks
from wagtail.blocks import field_block
from images import blocks as image_blocks
from videos import blocks as video_blocks
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.images.blocks import ImageChooserBlock
from wagtail.embeds import blocks as embed_blocks
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

class AudioBlock(blocks.StructBlock):
    caption =  blocks.CharBlock(required=False)
    audio = DocumentChooserBlock(required=True, help_text="File format: .m4a, .mp4, .mp, .wav, or .ogg")
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        if value['audio'].url[-4:] == '.wav':
            context['self'].format = 'wav'
        if value['audio'].url[-4:] == '.mp3':
            context['self'].format = 'mpeg'
        if value['audio'].url[-4:] == '.ogg':
            context['self'].format = 'ogg'
        else:
            context['self'].format = 'mp4'
        return context
    
    class Meta:
        template = 'article/stream_blocks/audio.html',
        icon = "media"

class PullQuoteBlock(blocks.StructBlock):
    content = blocks.CharBlock(required=True)
    position = blocks.ChoiceBlock(
        choices=[
            ('center', 'Center'),
            ('left', 'Left'),
            ('right', 'Right'),   
        ],
        default='center',
    )
    style = blocks.ChoiceBlock(
        choices=[
            ('style_default', 'Default'),
            ('contrast', 'Contrast'),
            ('enlarged_quotation', 'Enlarged Quotation')
        ],
        default='style_default',
    )
    source =  blocks.CharBlock(required=False)
    audio = DocumentChooserBlock(required=False, help_text="Optional, file format: .m4a, .mp4, .mp, .wav, or .ogg")


    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        if value['audio']:
            if value['audio'].url[-4:] == '.wav':
                context['self'].format = 'wav'
            if value['audio'].url[-4:] == '.mp3':
                context['self'].format = 'mpeg'
            if value['audio'].url[-4:] == '.ogg':
                context['self'].format = 'ogg'
            else:
                context['self'].format = 'mp4'
        return context

    class Meta:
        template = 'article/stream_blocks/quote.html',
        icon = "openquote"

class HeaderMenuBlock(blocks.StructBlock):

    list = blocks.ListBlock(
        blocks.StructBlock(
            [
                ('title', blocks.CharBlock()),
                ('id',blocks.CharBlock(help_text="Intended to be shared with a header so that this button will send the user to the section of the page with said header")),
                ('colour',blocks.CharBlock(default='0071c9')),
            ],
            label = "Page Link",
        )
    )

    class Meta:
        template = 'article/stream_blocks/pageLink.html',
        icon = "table"

class HeaderLinkBlock(blocks.StructBlock):
    title = blocks.CharBlock()
    id = blocks.CharBlock(help_text="Intended to be shared with a page link button so that clicking the button will scroll the user to this header")

    class Meta:
        template = 'article/stream_blocks/header.html',
        icon = "title"

class ChooseSideBlock(blocks.ChoiceBlock):
    choices=[('left', 'Left'),('right', 'Right'),]
    required=True

class ChooseViewBlock(blocks.StructBlock):
    view = blocks.ChoiceBlock(
        choices=[('vs-side-by-side', 'Side By Side'),('vs-over-image', 'Text Over Image'),],
        default=('vs-over-image', 'Text Over Image'),
        required=True
    )

    class Meta:
        template = "article/stream_blocks/ve_switch_view.html",
        icon = "view"

class GapBlock(blocks.StructBlock):
    id = blocks.CharBlock(required=False)
    height = blocks.IntegerBlock(required=True, default=0, min_value=0)

    class Meta:
        template = 'article/stream_blocks/ve_gap.html',
        icon = "arrows-up-down"

class VisualEssayBlock(blocks.StructBlock):
    view = ChooseViewBlock()
    content = blocks.StreamBlock([
        ('rich_text', blocks.StructBlock(
            [
                ('block', blocks.RichTextBlock(                                
                    label="Rich Text Block",
                    help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
                )),
                ('side',ChooseSideBlock(default=("right", "Right"))),
            ], icon = "doc-full"
        )),
        ('image', blocks.StructBlock(
            [
                ('block', image_blocks.ImageBlock()),
                ('side',ChooseSideBlock(default=("left", "Left"))),
            ], icon = "image"
        )),
        ('video', blocks.StructBlock(
            [
                ('block', video_blocks.OneOffVideoBlock(
                    label = "Credited/Captioned One-Off Video",
                    help_text = "Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block."
                )),
                ('side',ChooseSideBlock(default=("left", "Left"))),
            ], icon = "media"
        )),
        ('audio', blocks.StructBlock(
            [
                ('block', AudioBlock()),
                ('side',ChooseSideBlock(default=("left", "Left"))),
            ], icon = "media"
        )),
        ('raw_html', blocks.StructBlock(
            [
                ('block', blocks.RawHTMLBlock(
                    label = "Raw HTML Block",
                    help_text = "WARNING: DO NOT use this unless you really know what you're doing!"
                )),
                ('side',ChooseSideBlock(default=("left", "Left"))),
            ], icon = "code"
        )),
        ('quote', blocks.StructBlock(
            [
                ('block', PullQuoteBlock()),
                ('side',ChooseSideBlock(default=("left", "Left"))),
            ], icon = "openquote"
        )),
        ('header_link', blocks.StructBlock(
            [
                ('block', HeaderLinkBlock()),
                ('side',ChooseSideBlock(default=("right", "Right"))),
            ], icon = "title"
        )),
        ('gap', GapBlock()),
        ('switch_view', ChooseViewBlock()),
    ])

    class Meta:
        template = 'article/stream_blocks/visual-essay.html',
        icon = "form"

class GalleryBlock(blocks.StructBlock):
    images = blocks.ListBlock(
        image_blocks.ImageBlock()
    )

    class Meta:
        template = 'article/stream_blocks/gallery_block.html'
        icon = "image"
        label = "Carousel"

class PersonalityQuizBlock(blocks.StructBlock):
    personalities = blocks.ListBlock(
        blocks.StructBlock (
            [
                ('personality_name', blocks.CharBlock()),
                ('personality_result_text', blocks.RichTextBlock(help_text="Appears when user is matched with this personality. Use $PERCENTMATCH$ as a placeholder for the percent match with this personlity that is calculated from the users choices. The percent match is calculated by the amount of points obtained for that personality divided by the maximum possible amount of points you can get for that personality.")),
                ('personality_image', blocks.StructBlock(
                    [
                        ('image', ImageChooserBlock(required=False)),
                        ('caption', blocks.CharBlock(
                            max_length=255,
                            required=False,
                        )),
                        ('credit', blocks.CharBlock(
                            max_length=255,
                            required=False,
                        )),
                        ('alt_text', blocks.CharBlock(
                            max_length=255,
                            required=False,
                            help_text="For accessibility to screen reader users, enter a description of this image. Included any relevant text inside the image."
                        )),
                    ],
                    )
                )
            ]
        )
    )

    questions = blocks.ListBlock(
        blocks.StructBlock (
            [
                ('question_text', blocks.RichTextBlock()),
                ('answers', blocks.ListBlock(
                    blocks.StructBlock(
                        [
                            ('answer_text', blocks.CharBlock(
                                max_length=255,
                                required=True,)),
                            ('points', blocks.ListBlock(
                                blocks.IntegerBlock(help_text="The amount of points selecting this answer adds to the personality of the same item number (first item corresponds with the first personality)."),
                                help_text="Selecting an answer can give points to multiple personalities. The item number of the point corresponds with the item number of the personality."
                            )),
                        ]
                    ),
                )),
            ]
        )
    )

    class Meta:
        template = 'article/stream_blocks/personality_quiz.html'
        icon = "help"

class PdfBlock(blocks.StructBlock):
    pdf = DocumentChooserBlock(required=True, help_text="File format: .pdf")
    
    caption = blocks.CharBlock(
        max_length=255,
        required=False,
    )
    
    credit = blocks.CharBlock(
        max_length=255,
        required=False,
    )

    class Meta:
        template = 'article/stream_blocks/pdf.html'
        icon = "doc-full"