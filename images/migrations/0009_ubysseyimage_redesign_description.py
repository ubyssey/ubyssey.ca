import wagtail.fields
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('images', '0008_alter_ubysseyimage_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='ubysseyimage',
            name='redesign_description',
            field=wagtail.fields.RichTextField(
                blank=True,
                default='',
                help_text=(
                    'Optional description for redesigned pages. Legacy image descriptions '
                    'are not shown by the redesigned image viewer or galleries.'
                ),
            ),
        ),
    ]
