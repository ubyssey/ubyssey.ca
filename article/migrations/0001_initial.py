# Generated by Django 3.1.12 on 2021-07-09 10:44

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import images.models
import modelcluster.fields
import wagtail.core.blocks
import wagtail.core.fields
import wagtail.embeds.blocks
import wagtail.images.blocks
import wagtail.snippets.blocks


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('dispatch', '0108_auto_20210511_1359'),
        ('wagtailcore', '0062_comment_models_and_pagesubscription'),
        ('taggit', '0003_taggeditem_add_unique_index'),
    ]

    operations = [
        migrations.CreateModel(
            name='ArticleAuthorsOrderable',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
                ('author_role', models.CharField(blank=True, default='', max_length=50)),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ArticleFeaturedMediaOrderable',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
                ('caption', models.TextField(blank=True, default='')),
                ('credit', models.TextField(blank=True, default='')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ArticlePage',
            fields=[
                ('page_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='wagtailcore.page')),
                ('current_section', models.CharField(blank=True, default='', max_length=255)),
                ('content', wagtail.core.fields.StreamField([('richtext', wagtail.core.blocks.RichTextBlock(help_text='Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields', label='Rich Text Block')), ('plaintext', wagtail.core.blocks.TextBlock(help_text='Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text.', label='Plain Text Block')), ('dropcap', wagtail.core.blocks.TextBlock(help_text='DO NOT USE - Legacy block. Create a block where special dropcap styling with be applied to the first letter and the first letter only.\n\nThe contents of this block will be enclosed in a <p class="drop-cap">...</p> element, allowing its targetting for styling.\n\nNo RichText allowed.', label='Dropcap Block', template='article/stream_blocks/dropcap.html')), ('video', wagtail.core.blocks.StructBlock([('video_embed', wagtail.embeds.blocks.EmbedBlock(blank=False, null=False)), ('title', wagtail.core.blocks.CharBlock(max_length=255, required=False)), ('caption', wagtail.core.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.core.blocks.CharBlock(max_length=255, required=False))], help_text='Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block.', label='Credited/Captioned One-Off Video')), ('image', wagtail.core.blocks.StructBlock([('image', wagtail.images.blocks.ImageChooserBlock(required=True)), ('style', wagtail.core.blocks.ChoiceBlock(choices=[('default', 'Default'), ('left', 'Left'), ('right', 'Right')])), ('width', wagtail.core.blocks.ChoiceBlock(choices=[('full', 'Full'), ('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')])), ('caption', wagtail.core.blocks.CharBlock(max_length=255, required=False)), ('credit', wagtail.core.blocks.CharBlock(max_length=255, required=False))])), ('raw_html', wagtail.core.blocks.RawHTMLBlock(help_text="WARNING: DO NOT use this unless you really know what you're doing!", label='Raw HTML Block')), ('quote', wagtail.core.blocks.StructBlock([('content', wagtail.core.blocks.CharBlock(required=False)), ('source', wagtail.core.blocks.CharBlock(required=False))], label='Pull Quote', template='article/stream_blocks/quote.html')), ('gallery', wagtail.snippets.blocks.SnippetChooserBlock(target_model=images.models.GallerySnippet, template='article/stream_blocks/gallery.html'))], blank=True, null=True)),
                ('explicit_published_at', models.DateTimeField(blank=True, help_text='Optional. Publication date which is explicitly shown to the reader. Articles are seperately date/timestamped for database use; if this field is blank front page etc. will display the database publication date.', null=True, verbose_name='Published At (Override)')),
                ('last_modified_at', models.DateTimeField(auto_now=True)),
                ('show_last_modified', models.BooleanField(default=False, help_text='Check this to alert readers the article has been revised since its publication.')),
                ('lede', models.TextField(blank=True, default='')),
                ('is_breaking', models.BooleanField(default=False, verbose_name='Breaking News?')),
                ('breaking_timeout', models.DateTimeField(default=django.utils.timezone.now)),
                ('seo_keyword', models.CharField(blank=True, default='', max_length=100, verbose_name='SEO Keyword')),
                ('seo_description', models.TextField(blank=True, default='', verbose_name='SEO Description')),
                ('is_explicit', models.BooleanField(default=False, help_text='Check if this article contains advertiser-unfriendly content. Disables ads for this specific article.', verbose_name='Is Explicit?')),
                ('legacy_template', models.CharField(blank=True, default='', max_length=255)),
                ('legacy_template_data', models.TextField(blank=True, default='')),
                ('legacy_revision_number', models.IntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Article',
                'verbose_name_plural': 'Articles',
            },
            bases=('wagtailcore.page',),
        ),
        migrations.CreateModel(
            name='DispatchCounterpartSnippet',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dispatch_version', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='dispatch.article')),
            ],
        ),
        migrations.CreateModel(
            name='ArticlePageTag',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content_object', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='tagged_items', to='article.articlepage')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='article_articlepagetag_items', to='taggit.tag')),
            ],
            options={
                'verbose_name': 'article tag',
                'verbose_name_plural': 'article tags',
            },
        ),
    ]
