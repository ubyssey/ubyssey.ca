from django.db import migrations
import wagtail.fields


class Migration(migrations.Migration):
    dependencies = [("article", "0063_articledeadline")]
    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="standpoint_disclosure",
            field=wagtail.fields.RichTextField(blank=True, default="", help_text="Optional context about the writer's standpoint or relationship to the subject."),
        ),
    ]
