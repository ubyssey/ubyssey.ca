# Generated by Django 3.2.11 on 2023-07-13 21:44

from django.db import migrations
import images.models
import wagtail.blocks
import wagtail.fields
import wagtail.embeds.blocks
import wagtail.images.blocks
import wagtail.snippets.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0018_articlepage_noindex'),
    ]

    operations = [
        migrations.AlterField(
            model_name='articlepage',
            name='content',
            field=wagtail.fields.StreamField([('richtext', wagtail.blocks.RichTextBlock(help_text='Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields', label='Rich Text Block')), ('plaintext', wagtail.blocks.TextBlock(help_text='Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text.', label='Plain Text Block')), ('dropcap', wagtail.blocks.TextBlock(help_text='DO NOT USE - Legacy block. Create a block where special dropcap styling with be applied to the first letter and the first letter only.\n\nThe contents of this block will be enclosed in a <p class="drop-cap">...</p> element, allowing its targetting for styling.\n\nNo RichText allowed.', label='Dropcap Block', template='article/stream_blocks/dropcap.html')), ('video', wagtail.blocks.StructBlock([('video_embed', wagtail.embeds.blocks.EmbedBlock(blank=False, null=False)), ('title', wagtail.blocks.CharBlock(max_length=255, required=False)), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))], help_text='Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block.', label='Credited/Captioned One-Off Video')), ('image', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('style', wagtail.blocks.ChoiceBlock(choices=[('default', 'Default'), ('left', 'Left'), ('right', 'Right')])), ('width', wagtail.blocks.ChoiceBlock(choices=[('full', 'Full'), ('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')])), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))])), ('raw_html', wagtail.blocks.RawHTMLBlock(help_text="WARNING: DO NOT use this unless you really know what you're doing!", label='Raw HTML Block')), ('quote', wagtail.blocks.StructBlock([('content', wagtail.blocks.CharBlock(required=False)), ('source', wagtail.blocks.CharBlock(required=False))], icon='openquote', label='Pull Quote', template='article/stream_blocks/quote.html')), ('gallery', wagtail.snippets.blocks.SnippetChooserBlock(target_model=images.models.GallerySnippet, template='article/stream_blocks/gallery.html'))], blank=True, null=True),
        ),
    ]