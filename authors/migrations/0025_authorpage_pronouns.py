from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authors", "0024_alter_authorcontactorderable_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="authorpage",
            name="pronouns",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Optional public pronouns, shown on this author profile and in Our Team and Contact.",
                max_length=80,
            ),
        ),
    ]
