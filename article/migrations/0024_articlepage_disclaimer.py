# Generated by Django 4.1 on 2024-05-09 00:14

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0023_merge_20240416_1049'),
    ]

    operations = [
        migrations.AddField(
            model_name='articlepage',
            name='disclaimer',
            field=models.TextField(blank=True, default='', help_text="Use this format: <br>This is an opinion letter.</br> It does not reflect the opinions of The Ubyssey as a whole. You can submit an opinion <a href='ubyssey.ca/pages/submit-an-opinion'>here</a>."),
        ),
    ]
