from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("section", "0030_sectionpage_redesign_editor_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="sectionpage",
            name="redesign_editor_email_override",
            field=models.EmailField(
                blank=True,
                default="",
                help_text=(
                    "Optional public email for this section's Contact the editor box only. "
                    "Leave blank to use the editor's author-profile contact email."
                ),
                max_length=254,
            ),
        ),
    ]
