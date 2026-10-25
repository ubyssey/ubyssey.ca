from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('liveblog', '0005_alter_liveblogupdate_content'),
    ]

    operations = [
        migrations.AddField(
            model_name='liveblogarticlepage',
            name='redesign_header_choice',
            field=models.CharField(
                choices=[
                    ('big-centered', 'Standard'),
                    ('body-width', 'Body width'),
                    ('left-aligned', 'Image left'),
                    ('right-aligned', 'Image right'),
                    ('full-bleed', 'Full bleed'),
                    ('left-full-bleed', 'Full bleed, headline left'),
                    ('right-full-bleed', 'Full bleed, headline right'),
                ],
                default='big-centered',
                help_text='Header layout for the redesigned live-updates page.',
                max_length=32,
            ),
        ),
    ]
