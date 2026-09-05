from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("section", "0026_categorypage_beat")]

    operations = [
        migrations.AddField(
            model_name="sectionpage",
            name="spotify_episode_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="For The Vilest Rag landing page: paste the public Spotify episode URL used by the Latest Episode player. No iframe markup is required.",
            ),
        ),
    ]
