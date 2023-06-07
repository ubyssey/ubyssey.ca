# Generated by Django 3.2.11 on 2023-06-07 10:02

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('article', '0019_magazinetagorderable_magazinetagsnippet'),
    ]

    operations = [
        migrations.AddField(
            model_name='articlepage',
            name='magazine_tag',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='+', to='article.magazinetagsnippet'),
        ),
    ]
