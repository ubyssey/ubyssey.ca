# Generated by Django 3.2.11 on 2023-07-12 04:48

from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ('section', '0003_sectionpage_use_parent_colour'),
        ('archive', '0003_auto_20230711_2106'),
    ]

    operations = [
        migrations.CreateModel(
            name='SpoofOrderables',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
                ('page', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='spoofs_filters', to='archive.archivepage')),
                ('spoof_filter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='section.categorysnippet', verbose_name='Spoof')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
    ]
