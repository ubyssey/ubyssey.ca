from django.db import migrations, models
import wagtail.fields


STORY_FORM_CHOICES = [
    ("report", "Report"), ("live-update", "Live Update"),
    ("feature", "Feature"), ("profile", "Profile"), ("q-and-a", "Q&A"),
    ("review", "Review"), ("game-analysis", "Game Analysis"),
    ("commentary", "Commentary"), ("essay", "Essay"), ("column", "Column"),
    ("editorial", "Editorial"), ("letter-to-the-editor", "Letter to the Editor"),
    ("letter-from-the-editor", "Letter from the Editor"),
    ("public-service-announcement", "Public Service Announcement"),
]


class Migration(migrations.Migration):
    dependencies = [("article", "0072_alter_articlepage_covered_sport")]

    operations = [
        migrations.AddField(
            model_name="articlefeaturedmediaorderable",
            name="cover_caption",
            field=wagtail.fields.RichTextField(
                blank=True,
                default="",
                help_text="Optional display caption for the redesigned article cover. Existing legacy captions are not shown here automatically.",
            ),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="story_form",
            field=models.CharField(
                blank=True,
                choices=STORY_FORM_CHOICES,
                default="",
                help_text="Optional. Select a story form to show its approved statement. Leave blank for legacy articles unless it is reviewed and intentionally classified.",
                max_length=50,
            ),
        ),
    ]
