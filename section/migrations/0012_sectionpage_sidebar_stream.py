# Generated by Django 3.2.11 on 2023-05-25 04:16

from django.db import migrations
import wagtail.blocks
import wagtail.fields
import wagtail.images.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('section', '0011_categorysnippet_banner'),
    ]

    operations = [
        migrations.AddField(
            model_name='sectionpage',
            name='sidebar_stream',
            field=wagtail.fields.StreamField([('sidebar_advertisement_block', wagtail.blocks.StructBlock([])), ('sidebar_issues_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('issues', wagtail.blocks.StreamBlock([('issue', wagtail.blocks.StructBlock([('date', wagtail.blocks.DateBlock(required=True)), ('image', wagtail.images.blocks.ImageChooserBlock(required=False)), ('show_image', wagtail.blocks.BooleanBlock(required=False)), ('link', wagtail.blocks.URLBlock(required=True))]))]))])), ('sidebar_section_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('section', wagtail.blocks.PageChooserBlock(page_type=['section.SectionPage']))])), ('sidebar_flex_stream_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('stream', wagtail.blocks.StreamBlock([('image_link', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('link', wagtail.blocks.URLBlock(required=False))]))]))]))], blank=True, null=True),
        ),
    ]
