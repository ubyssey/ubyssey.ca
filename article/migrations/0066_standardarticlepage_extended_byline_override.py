from django.db import migrations, models
import wagtail.fields


class Migration(migrations.Migration):
    dependencies = [("article", "0065_standardarticlepage_full_bleed_nav_color")]
    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="extended_byline_override",
            field=wagtail.fields.RichTextField(
                blank=True,
                default="",
                help_text="Optional editor-authored extended byline. Leave blank to generate contributor credits from the article's assigned roles.",
            ),
        ),
        migrations.AlterField(
            model_name="standardarticlepage",
            name="story_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Not specified"), ("report", "Report"), ("live-update", "Live Update"),
                    ("feature", "Feature"), ("profile", "Profile"), ("q-and-a", "Q&A"),
                    ("review", "Review"), ("game-analysis", "Game Analysis"),
                    ("commentary", "Commentary"), ("analysis", "Analysis"), ("essay", "Essay"),
                    ("column", "Column"), ("editorial", "Editorial"),
                    ("letter-to-editor", "Letter to the Editor"),
                    ("letter-from-editor", "Letter from the Editor"),
                    ("public-service", "Public Service Announcement"),
                ],
                default="",
                max_length=40,
            ),
        ),
    ]
