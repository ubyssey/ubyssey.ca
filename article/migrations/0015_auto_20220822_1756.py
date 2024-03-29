# Generated by Django 3.2.11 on 2022-08-23 00:56

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('specialfeaturelanding', '0007_auto_20220822_1756'),
        ('wagtailmenus', '0023_remove_use_specific'),
        ('article', '0014_specialarticlelikepage_right_column_content'),
    ]

    operations = [
        migrations.AddField(
            model_name='articlepage',
            name='create_menu_from_parent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='articlepage',
            name='menu',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='wagtailmenus.flatmenu'),
        ),
        migrations.AddField(
            model_name='articlepage',
            name='parent_page_for_menu_generation',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='specialfeaturelanding.speciallandingpage'),
        ),
    ]
