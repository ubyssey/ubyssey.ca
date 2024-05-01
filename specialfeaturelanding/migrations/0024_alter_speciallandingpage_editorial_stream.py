# Generated by Django 3.2.11 on 2024-02-29 15:55

from django.db import migrations
import wagtail.blocks
import wagtail.fields
import wagtail.images.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('specialfeaturelanding', '0023_auto_20230815_2248'),
    ]

    operations = [
        migrations.AlterField(
            model_name='speciallandingpage',
            name='editorial_stream',
            field=wagtail.fields.StreamField([('banner', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-banner.html', 'guide-2021-banner.html'), ('textless_banner_block.html', 'textless_banner_block.html'), ('magazine-2024-banner.html', 'magazine-2024-banner.html')], required=False)), ('class_selector', wagtail.blocks.CharBlock(required=False)), ('image', wagtail.images.blocks.ImageChooserBlock(required=False)), ('title1', wagtail.blocks.CharBlock(required=False)), ('title2', wagtail.blocks.CharBlock(required=False)), ('credit', wagtail.blocks.CharBlock(required=False))])), ('credits', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editorial-stream.html', 'Guide 2021 Style'), ('magazine-2024-editorial-stream.html', 'Magazine 2024 Style')], required=False)), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('editor_credit', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editor-credit.html', 'Guide 2021 Style'), ('magazine-2024-editor-credit.html', 'Magazine 2024 Style')], required=False)), ('role', wagtail.blocks.CharBlock()), ('name', wagtail.blocks.CharBlock())]))]))])), ('image', wagtail.images.blocks.ImageChooserBlock()), ('note_with_header', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-editors-note.html', 'guide-2021-editors-note.html'), ('guide-2021-land-acknowledgement.html', 'guide-2021-land-acknowledgement.html')], required=False)), ('title', wagtail.blocks.CharBlock()), ('rich_text', wagtail.blocks.RichTextBlock())])), ('graphical_menu', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-graphical-menu.html', 'guide-2021-graphical-menu.html')], required=False)), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('graphical_menu_item', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('guide-2021-graphical-menu-item.html', 'guide-2021-graphical-menu-item.html')], required=False)), ('div_class_name', wagtail.blocks.CharBlock(default='box', max_length=255, required=True)), ('img_class_name', wagtail.blocks.CharBlock(default='photo_cover', max_length=255, required=True)), ('link', wagtail.blocks.URLBlock(required=True)), ('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('width', wagtail.blocks.IntegerBlock(required=False)), ('height', wagtail.blocks.IntegerBlock(required=False))]))]))])), ('child_articles', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('guide-2021-child-articles.html', 'Guide 2021 Style'), ('magazine-2024-child-articles.html', 'Magazine 2024 Style'), ('magazine-2024-table-of-contents.html', 'Magazine 2024 Table of Contents Style')]))])), ('flex_stream', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('2022-div-stream-block.html', '2022-div-stream-block.html')], required=False)), ('class_selector', wagtail.blocks.CharBlock()), ('stream', wagtail.blocks.StreamBlock([('raw_html', wagtail.blocks.RawHTMLBlock()), ('rich_text', wagtail.blocks.RichTextBlock()), ('image', wagtail.images.blocks.ImageChooserBlock()), ('rendition', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('rendition-fill-1200x1000.html', 'rendition-fill-1200x1000.html')], required=False)), ('image', wagtail.images.blocks.ImageChooserBlock())])), ('card', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('', 'Wagtail default'), ('mag_2023_card.html', 'mag_2023_card.html')], required=False)), ('class_name', wagtail.blocks.CharBlock(required=True)), ('card_title', wagtail.blocks.CharBlock(help_text='Add your title', required=True)), ('card_credit', wagtail.blocks.CharBlock(help_text='Credit Author', required=True)), ('card_image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('card_page', wagtail.blocks.PageChooserBlock(required=True))]))]))]))], blank=True, null=True, use_json_field=True),
        ),
    ]
