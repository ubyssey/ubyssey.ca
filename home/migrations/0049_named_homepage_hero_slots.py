from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_queue_to_named_slots(apps, schema_editor):
    HomePage = apps.get_model("home", "HomePage")
    HomepageRedesignStory = apps.get_model("home", "HomepageRedesignStory")
    slot_names = (
        "redesign_hero_top_left_id",
        "redesign_hero_bottom_left_id",
        "redesign_hero_centre_id",
        "redesign_hero_top_right_id",
        "redesign_hero_bottom_right_id",
    )

    for homepage in HomePage.objects.all():
        # Do not overwrite slots that an editor may already have configured.
        if any(getattr(homepage, slot) for slot in slot_names):
            continue
        legacy_entries = HomepageRedesignStory.objects.filter(home_page_id=homepage.pk).order_by("sort_order")[:5]
        for slot, entry in zip(slot_names, legacy_entries):
            setattr(homepage, slot, entry.article_id)
        homepage.save(update_fields=[slot.removesuffix("_id") for slot in slot_names])


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0048_remove_legacy_game_analysis_fixtures"),
    ]

    operations = [
        migrations.AddField(
            model_name="homepage",
            name="redesign_hero_top_left",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Top-left hero story"),
        ),
        migrations.AddField(
            model_name="homepage",
            name="redesign_hero_bottom_left",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Bottom-left hero story"),
        ),
        migrations.AddField(
            model_name="homepage",
            name="redesign_hero_centre",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Centre hero story"),
        ),
        migrations.AddField(
            model_name="homepage",
            name="redesign_hero_top_right",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Top-right hero story"),
        ),
        migrations.AddField(
            model_name="homepage",
            name="redesign_hero_bottom_right",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Bottom-right hero story"),
        ),
        migrations.RunPython(copy_legacy_queue_to_named_slots, migrations.RunPython.noop),
    ]
