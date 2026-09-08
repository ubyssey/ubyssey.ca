from django.db import migrations, models


LOCK_NAME = "ubyssey_redesign_contact_page_migration"


def _with_migration_lock(schema_editor, callback):
    """Run once even when multiple Swarm replicas apply migrations."""
    connection = schema_editor.connection
    if connection.vendor != "mysql":
        return callback()

    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(%s, %s)", [LOCK_NAME, 60])
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise RuntimeError("Could not acquire the redesigned Contact-page migration lock")
    try:
        return callback()
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", [LOCK_NAME])


def create_contact_page(apps, schema_editor):
    """Create the CMS owner for the public ``/contact/`` route.

    ``/contact/masthead/`` is an existing legacy Wagtail tree.  Its parent
    already owns the ``contact`` sibling slug, so this page has a descriptive
    internal slug and the stable public route is supplied explicitly by
    ``ubyssey.urls``.  That avoids mutating historical content during release.
    """
    from home.models import HomePage
    from specialfeaturelanding.models import RedesignAuxiliaryPage

    def create_page():
        if RedesignAuxiliaryPage.objects.filter(page_kind="contact").exists():
            return
        home = HomePage.objects.order_by("path").first()
        if home is None:
            return
        page = RedesignAuxiliaryPage(
            page_kind="contact",
            title="Redesigned — Contact",
            slug="redesigned-contact",
            display_title="Contact",
        )
        home.add_child(instance=page)
        page.save_revision().publish()

    _with_migration_lock(schema_editor, create_page)


class Migration(migrations.Migration):

    dependencies = [
        ("specialfeaturelanding", "0036_redesignteammember"),
    ]

    operations = [
        migrations.AlterField(
            model_name="redesignauxiliarypage",
            name="page_kind",
            field=models.CharField(
                choices=[
                    ("team", "Our Team"),
                    ("podcast", "The Vilest Rag"),
                    ("contact", "Contact"),
                ],
                editable=False,
                max_length=20,
                unique=True,
            ),
        ),
        migrations.RunPython(create_contact_page, migrations.RunPython.noop),
    ]
