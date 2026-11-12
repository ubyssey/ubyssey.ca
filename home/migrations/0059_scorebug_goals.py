from django.db import migrations
import wagtail.blocks
import wagtail.fields


def goals_field():
    return wagtail.fields.StreamField(
        wagtail.blocks.StreamBlock([
            ("goal", wagtail.blocks.StructBlock([
                ("team", wagtail.blocks.ChoiceBlock(choices=[("away", "Away team"), ("home", "Home team")])),
                ("scorer", wagtail.blocks.CharBlock(max_length=100)),
                ("minute", wagtail.blocks.CharBlock(
                    max_length=12,
                    help_text="Enter 23 or 45+2; the minute mark is added on the article.",
                )),
            ], label="Goal")),
        ]),
        blank=True,
        default=list,
        use_json_field=True,
        help_text=(
            "Soccer only. Add each scorer and minute in match order (for example, 23 or 45+2). "
            "Goals appear below the corresponding team's score on its Game Analysis article."
        ),
    )


class Migration(migrations.Migration):
    dependencies = [("home", "0058_championship_headings_and_scorebug_comparisons")]

    operations = [
        migrations.AddField(model_name="thunderbirdfixture", name="scorebug_goals", field=goals_field()),
        migrations.AddField(model_name="womenssoccermatch", name="scorebug_goals", field=goals_field()),
    ]
