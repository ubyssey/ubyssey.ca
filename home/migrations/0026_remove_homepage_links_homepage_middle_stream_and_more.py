# Generated by Django 4.1 on 2024-06-20 11:46

from django.db import migrations
import wagtail.blocks
import wagtail.fields
import wagtail.images.blocks
import wagtail.snippets.blocks


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0025_alter_homepage_sidebar_stream'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='homepage',
            name='links',
        ),
        migrations.AddField(
            model_name='homepage',
            name='middle_stream',
            field=wagtail.fields.StreamField([('links', wagtail.blocks.StructBlock([('links', wagtail.blocks.ListBlock(wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('url', wagtail.blocks.URLBlock(required=False)), ('description', wagtail.blocks.TextBlock(required=False))])))])), ('section', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('section/objects/section_bulleted.html', 'Default'), ('section/objects/section_timeline.html', 'Timeline')])), ('section', wagtail.blocks.PageChooserBlock(page_type=['section.SectionPage']))])), ('category', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('section/objects/section_bulleted.html', 'Default'), ('section/objects/section_timeline.html', 'Timeline')])), ('category', wagtail.snippets.blocks.SnippetChooserBlock('section.CategorySnippet'))])), ('tag', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('section/objects/section_bulleted.html', 'Default'), ('section/objects/section_timeline.html', 'Timeline')])), ('tag_slug', wagtail.blocks.CharBlock(help_text="Enter tag slug. For example for 'Christmas Movie' the slug would be 'christmas-movie'."))]))], blank=True, null=True, use_json_field=True),
        ),
        migrations.AlterField(
            model_name='homepage',
            name='sidebar_stream',
            field=wagtail.fields.StreamField([('sidebar_advertisement_block', wagtail.blocks.StructBlock([])), ('sidebar_issues_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('issues', wagtail.blocks.StreamBlock([('issue', wagtail.blocks.StructBlock([('date', wagtail.blocks.DateBlock(required=True)), ('image', wagtail.images.blocks.ImageChooserBlock(required=False)), ('show_image', wagtail.blocks.BooleanBlock(required=False)), ('link', wagtail.blocks.URLBlock(required=True))]))]))])), ('sidebar_category_block', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('infinitefeed/sidebar/sidebar_section_block.html', 'Default'), ('infinitefeed/sidebar/sidebar_latest_block.html', 'Latest')])), ('category', wagtail.snippets.blocks.SnippetChooserBlock('section.CategorySnippet'))])), ('sidebar_section_block', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('infinitefeed/sidebar/sidebar_section_block.html', 'Default'), ('infinitefeed/sidebar/sidebar_latest_block.html', 'Latest')])), ('section', wagtail.blocks.PageChooserBlock(page_type=['section.SectionPage']))])), ('sidebar_flex_stream_block', wagtail.blocks.StructBlock([('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('stream', wagtail.blocks.StreamBlock([('image_link', wagtail.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('link', wagtail.blocks.URLBlock(required=False))]))]))])), ('sidebar_latest', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('infinitefeed/sidebar/sidebar_section_block.html', 'Default'), ('infinitefeed/sidebar/sidebar_latest_block.html', 'Latest')])), ('title', wagtail.blocks.CharBlock(max_length=255, required=True))])), ('sidebar_manual', wagtail.blocks.StructBlock([('template', wagtail.blocks.ChoiceBlock(choices=[('infinitefeed/sidebar/sidebar_section_block.html', 'Default'), ('infinitefeed/sidebar/sidebar_latest_block.html', 'Latest')])), ('title', wagtail.blocks.CharBlock(max_length=255, required=True)), ('articles', wagtail.blocks.ListBlock(wagtail.blocks.PageChooserBlock(page_type=['article.ArticlePage'])))]))], blank=True, null=True, use_json_field=True),
        ),
    ]