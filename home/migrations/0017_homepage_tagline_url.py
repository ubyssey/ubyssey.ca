# Generated by Django 3.2.11 on 2023-06-20 15:50

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0016_homepage_tagline'),
    ]

    operations = [
        migrations.AddField(
            model_name='homepage',
            name='tagline_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
