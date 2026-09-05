from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("specialfeaturelanding", "0033_alter_speciallandingpage_editorial_stream")]

    operations = [
        migrations.AddField(
            model_name="speciallandingpage",
            name="spotify_episode_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Paste the public Spotify episode URL used by the Latest Episode player.",
            ),
        ),
    ]
