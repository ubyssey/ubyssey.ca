# Generated by Django 4.1 on 2024-05-25 09:41

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authors', '0017_auto_20230815_2248'),
    ]

    operations = [
        migrations.AddField(
            model_name='authorpage',
            name='last_activity',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
