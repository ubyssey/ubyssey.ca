# Generated by Django 3.1.8 on 2021-06-08 00:46

from django.db import migrations
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ('navigation', '0003_auto_20210607_1652'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='navigationmenu',
            options={'verbose_name': 'Navigation Menu', 'verbose_name_plural': 'Navigation Menus'},
        ),
        migrations.AlterField(
            model_name='navigationmenuitem',
            name='navigation_menu',
            field=modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='navigation_menu_items', to='navigation.navigationmenu'),
        ),
    ]
