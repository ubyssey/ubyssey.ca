from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("specialfeaturelanding", "0039_publish_redesigned_auxiliary_pages"),
    ]

    operations = [
        migrations.AddField(
            model_name="redesignteammember",
            name="email_override",
            field=models.EmailField(
                blank=True,
                default="",
                help_text=(
                    "Optional public email for this Our Team member and their Contact directory entry. "
                    "Leave blank to use the author's contact email; the author profile is unchanged."
                ),
                max_length=254,
            ),
        ),
    ]
