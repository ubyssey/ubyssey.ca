from django.core.validators import RegexValidator
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
                            ("label", wagtail.blocks.CharBlock(max_length=30, help_text="For example: Shots, Rebounds, or Aces.")),
                            ("away_value", wagtail.blocks.CharBlock(max_length=20, required=False)),
                            ("home_value", wagtail.blocks.CharBlock(max_length=20, required=False)),
                        ],
                        label="Team comparison",
                    ),
                ),
            ],
            max_num=3,
        ),
        blank=True,
        default=list,
        use_json_field=True,
        help_text=(
            "Optional, up to three comparisons. Suggestions: soccer—shots, shots on target, corners; "
            "basketball—rebounds, assists, field goal %; hockey—shots, power plays, saves; "
            "volleyball—kills, blocks, aces; football—total yards, first downs, turnovers; "
            "rugby—tries, conversions, penalties. Use the same measure for both teams."
        ),
    )


class Migration(migrations.Migration):
    dependencies = [("home", "0056_womens_soccer_championship")]

    operations = [
        migrations.AddField(
            model_name="thunderbirdfixture",
            name="away_scorebug_color",
            field=models.CharField(
                blank=True, max_length=7, validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$")],
                help_text="Optional six-digit hex colour for the away team's score bug panel, such as #002145.",
            ),
        ),
        migrations.AddField(
            model_name="thunderbirdfixture",
            name="home_scorebug_color",
            field=models.CharField(
                blank=True, max_length=7, validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$")],
                help_text="Optional six-digit hex colour for the home team's score bug panel.",
            ),
        ),
        migrations.AddField(model_name="thunderbirdfixture", name="scorebug_stats", field=stats_field()),
        migrations.AddField(
            model_name="womenssoccerteam",
            name="scorebug_color",
            field=models.CharField(
                blank=True, max_length=7, validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$")],
                help_text="Optional team-colour hex code for match analysis score bugs, such as #002145.",
            ),
        ),
        migrations.AddField(model_name="womenssoccermatch", name="scorebug_stats", field=stats_field()),
    ]
