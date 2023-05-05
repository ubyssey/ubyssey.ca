# Generated by Django 3.2.5 on 2021-08-27 04:03

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ads', '0004_adsettings'),
        ('home', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='homepage',
            name='home_leaderboard_ad_slot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='ads.adslot'),
        ),
        migrations.AddField(
            model_name='homepage',
            name='home_mobile_leaderboard_ad_slot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='ads.adslot'),
        ),
    ]
