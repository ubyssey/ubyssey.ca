from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("article", "0073_redesign_cover_caption_and_story_form"),
        ("home", "0049_named_homepage_hero_slots"),
    ]

    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="game_fixture",
            field=models.OneToOneField(
                blank=True,
                help_text="For Game Analysis stories only: link the Thunderbird fixture this story covers. A completed fixture will show a Read analysis link in Game Analyses.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="game_analysis_article",
                to="home.thunderbirdfixture",
            ),
        ),
    ]
