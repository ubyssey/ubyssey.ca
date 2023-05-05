# Generated by Django 3.2.11 on 2022-07-07 23:18

from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ('wagtailcore', '0066_collection_management_permissions'),
        ('ads', '0007_auto_20210904_1518'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdHeadOrderable',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='AdPlacementOrderable',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(blank=True, editable=False, null=True)),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='AdTagSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('site', models.OneToOneField(editable=False, on_delete=django.db.models.deletion.CASCADE, to='wagtailcore.site')),
            ],
            options={
                'verbose_name': 'Ad Settings',
                'verbose_name_plural': "Instances of 'Ad Settings'",
            },
        ),
        migrations.AlterField(
            model_name='adslot',
            name='dfp',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Ad Unit Name'),
        ),
        migrations.AlterField(
            model_name='adslot',
            name='div_id',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='HTML Element ID'),
        ),
        migrations.CreateModel(
            name='ArticleAdHeadOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='article_head_tags', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='ArticleHeaderPlacementOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='article_header_placements', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='ArticleSidebarPlacementOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='article_sidebar_placements', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='HomeAdHeadOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='home_head_tags', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='HomeHeaderPlacementOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='home_header_placements', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='HomeSidebarPlacementOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='home_sidebar_placements', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='SectionAdHeadOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='section_head_tags', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.CreateModel(
            name='SectionHeaderPlacementOrderable',
            fields=[
                ('adplacementorderable_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='ads.adplacementorderable')),
                ('settings', modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name='section_header_placements', to='ads.adtagsettings')),
            ],
            options={
                'ordering': ['sort_order'],
                'abstract': False,
            },
            bases=('ads.adplacementorderable',),
        ),
        migrations.DeleteModel(
            name='AdSettings',
        ),
        migrations.AddField(
            model_name='adplacementorderable',
            name='ad_slot',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='ads.adslot', verbose_name='Ad Slot'),
        ),
        migrations.AddField(
            model_name='adheadorderable',
            name='ad_slot',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='ads.adslot', verbose_name='Ad Slot'),
        ),
    ]
