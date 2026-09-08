from django.db import migrations
import wagtail.fields


class Migration(migrations.Migration):
    dependencies = [("article", "0068_standardarticlepage_full_bleed_nav_color")]
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
    ]
