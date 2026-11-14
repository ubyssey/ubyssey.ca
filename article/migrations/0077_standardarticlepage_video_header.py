from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("article", "0076_alter_standardarticlepage_story_form"),
        ("wagtaildocs", "0014_alter_document_file_size"),
    ]

    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="video_header_enabled",
            field=models.BooleanField(default=False, help_text="Show a full-bleed looping video preview instead of the article cover image. Keep a featured image for story cards and as a fallback."),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="video_preview_file",
            field=models.ForeignKey(blank=True, help_text="Upload an MP4 or WebM for the muted, looping preview. Leave empty if using a YouTube link.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtaildocs.document"),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="video_preview_youtube_url",
            field=models.URLField(blank=True, default="", help_text="Alternatively, paste a YouTube URL for the muted, looping preview."),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="video_full_file",
            field=models.ForeignKey(blank=True, help_text="Upload an MP4 or WebM for fullscreen playback. Leave empty if using a YouTube link.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtaildocs.document"),
        ),
        migrations.AddField(
            model_name="standardarticlepage",
            name="video_full_youtube_url",
            field=models.URLField(blank=True, default="", help_text="Alternatively, paste the YouTube URL for fullscreen playback."),
        ),
    ]
