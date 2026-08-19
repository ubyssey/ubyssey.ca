from django.db import migrations, models


def move_position_urls_to_shared_form(apps, schema_editor):
    JoinLandingPage = apps.get_model("join", "JoinLandingPage")
    JoinPosition = apps.get_model("join", "JoinPosition")

    open_positions = JoinPosition.objects.exclude(application_url="")
    shared_url = (
        open_positions.values_list("application_url", flat=True).first() or ""
    )

    if shared_url:
        JoinLandingPage.objects.update(application_form_url=shared_url)
    open_positions.update(accepting_applications=True)


def restore_position_urls(apps, schema_editor):
    JoinLandingPage = apps.get_model("join", "JoinLandingPage")
    JoinPosition = apps.get_model("join", "JoinPosition")

    shared_url = (
        JoinLandingPage.objects.values_list("application_form_url", flat=True).first()
        or ""
    )
    if shared_url:
        JoinPosition.objects.filter(accepting_applications=True).update(
            application_url=shared_url,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("join", "0002_application_process"),
    ]

    operations = [
        migrations.AddField(
            model_name="joinlandingpage",
            name="application_form_url",
            field=models.URLField(
                blank=True,
                help_text=(
                    "Shared application form used by every open position. "
                    "Positions remain closed until this URL is populated."
                ),
            ),
        ),
        migrations.AddField(
            model_name="joinposition",
            name="accepting_applications",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Show this position as open when the shared application "
                    "form URL on the main Join page is also populated."
                ),
            ),
        ),
        migrations.RunPython(
            move_position_urls_to_shared_form,
            restore_position_urls,
        ),
        migrations.RemoveField(
            model_name="joinposition",
            name="application_url",
        ),
    ]
