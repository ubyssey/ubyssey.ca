# Generated by Django 3.2.11 on 2023-05-19 09:32

from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0018_articlepage_noindex'),
        ('home', '0013_homepage_cover_story'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='homepage',
            name='above_cut_stream',
        ),
        migrations.RemoveField(
            model_name='homepage',
            name='sections_stream',
        ),
        migrations.CreateModel(
            name='TopArticlesOrderable',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
                ('article', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='top_articles', to='article.articlepage')),
                ('home_page', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='top_articles', to='home.homepage')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
    ]
