from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


LOCK_NAME = "ubyssey_redesign_contact_entries_migration"


def _with_migration_lock(schema_editor, callback):
    connection = schema_editor.connection
    if connection.vendor != "mysql":
        return callback()
    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(%s, %s)", [LOCK_NAME, 60])
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise RuntimeError("Could not acquire the redesigned Contact-entry migration lock")
    try:
        return callback()
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", [LOCK_NAME])


def seed_existing_business_contacts(apps, schema_editor):
    """Preserve the two pre-existing directory contacts as editable CMS rows."""
    from specialfeaturelanding.models import RedesignAuxiliaryPage, RedesignContactEntry

    def seed_entries():
        page = RedesignAuxiliaryPage.objects.filter(page_kind="contact").first()
        if page is None:
            return
        entries = (
            ("Business Manager", "Business Office", "business@ubyssey.ca"),
            ("Advertising", "Advertising Team", "advertising@ubyssey.ca"),
        )
        for index, (role, name, email) in enumerate(entries):
            RedesignContactEntry.objects.get_or_create(
                page=page,
                email=email,
                defaults={"role": role, "name": name, "sort_order": index},
            )

    _with_migration_lock(schema_editor, seed_entries)


class Migration(migrations.Migration):

    dependencies = [
        ("specialfeaturelanding", "0037_redesign_contact_page"),
    ]

    operations = [
        migrations.CreateModel(
            name="RedesignContactEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("role", models.CharField(max_length=120)),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="contact_entries", to="specialfeaturelanding.redesignauxiliarypage")),
            ],
            options={"ordering": ("sort_order",), "verbose_name": "Contact-only directory entry", "verbose_name_plural": "Contact-only directory entries"},
        ),
        migrations.RunPython(seed_existing_business_contacts, migrations.RunPython.noop),
    ]
