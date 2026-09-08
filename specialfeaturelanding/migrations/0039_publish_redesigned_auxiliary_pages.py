from django.db import migrations


LOCK_NAME = "ubyssey_redesign_auxiliary_page_publish_migration"


def _with_migration_lock(schema_editor, callback):
    """Run the publication step once when Swarm starts several replicas."""
    connection = schema_editor.connection
    if connection.vendor != "mysql":
        return callback()

    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(%s, %s)", [LOCK_NAME, 60])
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise RuntimeError("Could not acquire the redesigned auxiliary-page publish lock")
    try:
        return callback()
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", [LOCK_NAME])


def publish_redesigned_auxiliary_pages(apps, schema_editor):
    """Publish the seeded pages after all of their inline tables exist."""
    # Use the runtime model because Wagtail's migration-state models omit
    # tree and revision methods. Migration 0038 has created every reverse
    # relation that Wagtail serializes into a page revision.
    from specialfeaturelanding.models import RedesignAuxiliaryPage

    def publish_pages():
        for page in RedesignAuxiliaryPage.objects.filter(
            page_kind__in=("team", "podcast", "contact")
        ):
            page.save_revision().publish()

    _with_migration_lock(schema_editor, publish_pages)


class Migration(migrations.Migration):

    dependencies = [
        ("specialfeaturelanding", "0038_redesigncontactentry"),
    ]

    operations = [
        migrations.RunPython(
            publish_redesigned_auxiliary_pages, migrations.RunPython.noop
        ),
    ]
