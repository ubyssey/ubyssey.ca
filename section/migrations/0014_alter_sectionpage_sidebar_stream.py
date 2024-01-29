# Generated by Django 3.2.11 on 2023-12-12 03:58

from django.db import migrations
import section.models
import wagtail.blocks
import wagtail.fields
import wagtail.images.blocks
import wagtail.snippets.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('section', '0013_alter_sectionpage_sidebar_stream'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sectionpage',
            name='sidebar_stream',
            field=wagtail.fields.StreamField([('sidebar_advertisement_block', wagtail.blocks.StructBlock([])), ('sidebar_issues_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('issues', wagtail.blocks.StreamBlock([('issue', wagtail.blocks.StructBlock([('date', wagtail.blocks.DateBlock(required=True)), ('image', wagtail.images.blocks.ImageChooserBlock(required=False)), ('show_image', wagtail.blocks.BooleanBlock(required=False)), ('link', wagtail.blocks.URLBlock(required=True))]))]))])), ('sidebar_section_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('section', wagtail.blocks.PageChooserBlock(page_type=['section.SectionPage']))])), ('sidebar_flex_stream_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('stream', wagtail.blocks.StreamBlock([('image_link', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('link', wagtail.blocks.URLBlock(required=False))]))]))])), ('sidebar_category_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('category', wagtail.snippets.blocks.SnippetChooserBlock(section.models.CategorySnippet))])), ('sidebar_manual', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('articles', wagtail.blocks.ListBlock(wagtail.blocks.PageChooserBlock(page_type=['article.ArticlePage'])))]))], blank=True, null=True, use_json_field=True),
        ),
    ]