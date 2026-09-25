from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0051_homepage_ams_election"),
    ]

    operations = [
        migrations.AddField(
            model_name="homepage",
            name="game_analysis_enabled",
            field=models.BooleanField(
                default=True,
                help_text="Show Game Analyses on the homepage. Turn off to skip the panel and its story and fixture queries.",
            ),
        ),
    ]
