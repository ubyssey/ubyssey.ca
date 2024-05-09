# Generated by Django 3.2.11 on 2022-09-17 05:35

from django.db import migrations
import wagtail.blocks
import wagtail.fields
import wagtail.images.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('specialfeaturelanding', '0015_speciallandingpage_use_parent_colour'),
    ]

    operations = [
        migrations.AlterField(
            model_name='speciallandingpage',
            name='editorial_stream',
            field=wagtail.fields.StreamField([('banner', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-banner.html', 'guide-2021-banner.html')], required=False)), ('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('title1', wagtail.blocks.CharBlock()), ('title2', wagtail.blocks.CharBlock()), ('credit', wagtail.blocks.CharBlock())])), ('credits', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editorial-stream.html', 'guide-2021-editorial-stream.html')], required=False)), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('editor_credit', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editor-credit.html', 'guide-2021-editor-credit.html')], required=False)), ('role', wagtail.blocks.CharBlock()), ('name', wagtail.blocks.CharBlock())]))]))])), ('image', wagtail.images.blocks.ImageChooserBlock()), ('note_with_header', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editors-note.html', 'guide-2021-editors-note.html'), ('guide-2021-land-acknowledgement.html', 'guide-2021-land-acknowledgement.html')], required=False)), ('title', wagtail.blocks.CharBlock()), ('rich_text', wagtail.blocks.RichTextBlock())])), ('graphical_menu', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-graphical-menu.html', 'guide-2021-graphical-menu.html')], required=False)), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('graphical_menu_item', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-graphical-menu-item.html', 'guide-2021-graphical-menu-item.html')], required=False)), ('div_class_name', wagtail.blocks.CharBlock(default='box', max_length=255, required=True)), ('img_class_name', wagtail.blocks.CharBlock(default='photo_cover', max_length=255, required=True)), ('link', wagtail.blocks.URLBlock(required=True)), ('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('width', wagtail.blocks.IntegerBlock(required=False)), ('height', wagtail.blocks.IntegerBlock(required=False))]))]))])), ('child_articles', wagtail.blocks.StructBlock([])), ('flex_stream', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('2022-div-stream-block.html', '2022-div-stream-block.html')], required=False)), ('class_selector', wagtail.blocks.CharBlock()), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('image', wagtail.images.blocks.ImageChooserBlock())]))]))], blank=True, null=True),
        ),
    ]
