# Generated by Django 3.2.11 on 2023-08-16 05:48

from django.db import migrations
import images.models
import wagtail.blocks
import wagtail.documents.blocks
import wagtail.embeds.blocks
import wagtail.fields
import wagtail.images.blocks
import wagtail.snippets.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0020_alter_articlepage_content'),
    ]

    operations = [
        migrations.AlterField(
            model_name='articlepage',
            name='content',
            field=wagtail.fields.StreamField([('richtext', wagtail.blocks.RichTextBlock(help_text='Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields', label='Rich Text Block')), ('plaintext', wagtail.blocks.TextBlock(help_text='Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text.', label='Plain Text Block')), ('dropcap', wagtail.blocks.TextBlock(help_text='DO NOT USE - Legacy block. Create a block where special dropcap styling with be applied to the first letter and the first letter only.\n\nThe contents of this block will be enclosed in a <p class="drop-cap">...</p> element, allowing its targetting for styling.\n\nNo RichText allowed.', label='Dropcap Block', template='article/stream_blocks/dropcap.html')), ('video', wagtail.blocks.StructBlock([('video_embed', wagtail.embeds.blocks.EmbedBlock(blank=False, null=False)), ('title', wagtail.blocks.CharBlock(max_length=255, required=False)), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))], help_text='Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block.', label='Credited/Captioned One-Off Video')), ('image', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('style', wagtail.blocks.ChoiceBlock(choices=[('default', 'Default'), ('left', 'Left'), ('right', 'Right')])), ('width', wagtail.blocks.ChoiceBlock(choices=[('full', 'Full'), ('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')])), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))])), ('raw_html', wagtail.blocks.RawHTMLBlock(help_text="WARNING: DO NOT use this unless you really know what you're doing!", label='Raw HTML Block')), ('quote', wagtail.blocks.StructBlock([('content', wagtail.blocks.CharBlock(required=True)), ('source', wagtail.blocks.CharBlock(required=False)), ('audio', wagtail.documents.blocks.DocumentChooserBlock(help_text='optional, must be mp3 format', required=False))])), ('gallery', wagtail.snippets.blocks.SnippetChooserBlock(target_model=images.models.GallerySnippet, template='article/stream_blocks/gallery.html')), ('header_link', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock()), ('id', wagtail.blocks.CharBlock(help_text='Intended to be shared with a page link button so that clicking the button will scroll the user to this header'))])), ('header_menu', wagtail.blocks.StructBlock([('list', wagtail.blocks.ListBlock(wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock()), ('id', wagtail.blocks.CharBlock(help_text='Intended to be shared with a header so that this button will send the user to the section of the page with said header')), ('colour', wagtail.blocks.CharBlock(default='0071c9'))], label='Page Link')))])), ('visual_essay', wagtail.blocks.StructBlock([('view', wagtail.blocks.StructBlock([('view', wagtail.blocks.ChoiceBlock(choices=[('vs-side-by-side', 'Side By Side'), ('vs-over-image', 'Text Over Image')]))])), ('content', wagtail.blocks.StreamBlock([('rich_text', wagtail.blocks.StructBlock([('block', wagtail.blocks.RichTextBlock(help_text='Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields', label='Rich Text Block')), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='doc-full')), ('image', wagtail.blocks.StructBlock([('block', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('style', wagtail.blocks.ChoiceBlock(choices=[('default', 'Default'), ('left', 'Left'), ('right', 'Right')])), ('width', wagtail.blocks.ChoiceBlock(choices=[('full', 'Full'), ('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')])), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))])), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='image')), ('video', wagtail.blocks.StructBlock([('block', wagtail.blocks.StructBlock([('video_embed', wagtail.embeds.blocks.EmbedBlock(blank=False, null=False)), ('title', wagtail.blocks.CharBlock(max_length=255, required=False)), ('caption', wagtail.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.blocks.CharBlock(max_length=255, required=False))], help_text='Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block.', label='Credited/Captioned One-Off Video')), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='media')), ('raw_html', wagtail.blocks.StructBlock([('block', wagtail.blocks.RawHTMLBlock(help_text="WARNING: DO NOT use this unless you really know what you're doing!", label='Raw HTML Block')), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='code')), ('quote', wagtail.blocks.StructBlock([('block', wagtail.blocks.StructBlock([('content', wagtail.blocks.CharBlock(required=True)), ('source', wagtail.blocks.CharBlock(required=False)), ('audio', wagtail.documents.blocks.DocumentChooserBlock(help_text='optional, must be mp3 format', required=False))])), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='openquote')), ('header_link', wagtail.blocks.StructBlock([('block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock()), ('id', wagtail.blocks.CharBlock(help_text='Intended to be shared with a page link button so that clicking the button will scroll the user to this header'))])), ('side', wagtail.blocks.ChoiceBlock(choices=[('left', 'Left'), ('right', 'Right')]))], icon='title')), ('gap', wagtail.blocks.StructBlock([('id', wagtail.blocks.CharBlock(required=False)), ('height', wagtail.blocks.IntegerBlock(default=0, min_value=0, required=True))])), ('switch_view', wagtail.blocks.StructBlock([('view', wagtail.blocks.ChoiceBlock(choices=[('vs-side-by-side', 'Side By Side'), ('vs-over-image', 'Text Over Image')]))]))]))]))], blank=True, null=True, use_json_field=True),
        ),
        migrations.AlterField(
            model_name='specialarticlelikepage',
            name='right_column_content',
            field=wagtail.fields.StreamField([('richtext', wagtail.blocks.RichTextBlock(help_text='Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields', label='Rich Text Block')), ('plaintext', wagtail.blocks.TextBlock(help_text='Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text.', label='Plain Text Block'))], blank=True, null=True, use_json_field=True),
        ),
    ]
