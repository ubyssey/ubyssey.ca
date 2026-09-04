from django.db import migrations, models
import wagtail.fields


class Migration(migrations.Migration):
    dependencies = [("article", "0059_merge_20260719_1938")]
    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="standpoint_disclosure",
            field=wagtail.fields.RichTextField(blank=True, default="", help_text="Optional context about the writer's standpoint or relationship to the subject."),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="story_type",
            field=models.CharField(blank=True, choices=[("", "Not specified"), ("report", "Report"), ("feature", "Feature"), ("profile", "Profile"), ("q-and-a", "Q&A"), ("review", "Review"), ("game-analysis", "Game Analysis"), ("commentary", "Commentary"), ("analysis", "Analysis"), ("essay", "Essay"), ("column", "Column"), ("editorial", "Editorial"), ("letter-to-editor", "Letter to the Editor"), ("letter-from-editor", "Letter from the Editor"), ("public-service", "Public Service Announcement")], default="", max_length=40),
        ),
    ]
