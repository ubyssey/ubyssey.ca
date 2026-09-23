from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0050_remove_womens_rugby_from_game_analyses"),
    ]

    operations = [
        migrations.AddField(
            model_name="homepage",
            name="ams_election_enabled",
            field=models.BooleanField(default=False, help_text="Show the election feature only after its description and both story slots are ready."),
        ),
        migrations.AddField(
            model_name="homepage",
            name="ams_election_placement",
            field=models.CharField(choices=[
                ("before_hero", "Above the top stories"),
                ("between_hero_games", "Between the top stories and Game Analyses (default)"),
                ("after_games", "Below Game Analyses"),
            ], default="between_hero_games", max_length=24),
        ),
        migrations.AddField(
            model_name="homepage",
            name="ams_election_heading",
            field=models.CharField(default="2026 AMS VP Student Life By-Election", max_length=120),
        ),
        migrations.AddField(
            model_name="homepage",
            name="ams_election_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="homepage",
            name="ams_election_story_left",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Left election story"),
        ),
        migrations.AddField(
            model_name="homepage",
            name="ams_election_story_right",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage", verbose_name="Right election story"),
        ),
    ]
