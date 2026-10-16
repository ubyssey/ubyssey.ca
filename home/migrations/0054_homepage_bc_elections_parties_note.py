from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0053_bc_local_elections_2026"),
    ]

    operations = [
        migrations.AddField(
            model_name="homepage",
            name="bc_elections_parties_note_heading",
            field=models.CharField(
                max_length=120,
                blank=True,
                default="",
                help_text="Optional heading in the space below the homepage party links.",
            ),
        ),
        migrations.AddField(
            model_name="homepage",
            name="bc_elections_parties_note_body",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Optional body text below the homepage party links.",
            ),
        ),
    ]
