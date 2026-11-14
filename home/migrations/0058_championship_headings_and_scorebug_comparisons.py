from django.db import migrations, models
import wagtail.blocks
import wagtail.fields


def stats_field():
    return wagtail.fields.StreamField(
        wagtail.blocks.StreamBlock(
            [
                (
                    "comparison",
                    wagtail.blocks.StructBlock(
                        [
                            (
                                "label",
                                wagtail.blocks.CharBlock(
                                    max_length=30,
                                    required=False,
                                    help_text="Optional label, such as Shots, Rebounds, or Aces.",
                                ),
                            ),
                            ("away_value", wagtail.blocks.CharBlock(max_length=20, required=False)),
                            ("home_value", wagtail.blocks.CharBlock(max_length=20, required=False)),
                        ],
                        label="Team comparison",
                    ),
                ),
            ],
        ),
        blank=True,
        default=list,
        use_json_field=True,
        help_text=(
            "Optional comparisons. Leave this list empty to show only teams, score and match details. "
            "Suggestions: soccer—shots, shots on target, corners; "
            "basketball—rebounds, assists, field goal %; hockey—shots, power plays, saves; "
            "volleyball—kills, blocks, aces; football—total yards, first downs, turnovers; "
            "rugby—tries, conversions, penalties. Use the same measure for both teams."
        ),
    )


class Migration(migrations.Migration):
    dependencies = [("home", "0057_article_scorebugs")]

    operations = [
        migrations.AddField(
            model_name="womenssoccerchampionshippage",
            name="championship_path_heading",
            field=models.CharField(default="Championship Path", max_length=100),
        ),
        migrations.AddField(
            model_name="womenssoccerchampionshippage",
            name="consolation_path_heading",
            field=models.CharField(default="Consolation Path", max_length=100),
        ),
        migrations.AddField(
            model_name="womenssoccerchampionshippage",
            name="team_statistics_heading",
            field=models.CharField(default="Team Statistics", max_length=100),
        ),
        migrations.AlterField(
            model_name="thunderbirdfixture", name="scorebug_stats", field=stats_field(),
        ),
        migrations.AlterField(
            model_name="womenssoccermatch", name="scorebug_stats", field=stats_field(),
        ),
    ]
