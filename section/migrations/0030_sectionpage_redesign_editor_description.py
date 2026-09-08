from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("section", "0029_alter_sectionredesignfeaturedarticle_id")]

    operations = [
        migrations.AddField(
            model_name="sectionpage",
            name="redesign_editor_description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Custom copy for the Contact the editor box. This does not use the editor's author-profile bio.",
                max_length=120,
            ),
        ),
    ]
