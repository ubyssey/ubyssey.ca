# Generated by Django 3.2.11 on 2023-05-17 07:18

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0019_auto_20230517_0017'),
    ]

    operations = [
        migrations.AlterField(
            model_name='articlepage',
            name='pinned_timeout',
            field=models.DateTimeField(blank=True, default=django.utils.timezone.now),
        ),
    ]