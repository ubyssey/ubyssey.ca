from django.db import migrations, models
import django.db.models.deletion
import wagtail.fields


LOCK_NAME = "ubyssey_redesign_auxiliary_page_migration"


def _with_migration_lock(schema_editor, callback):
    """Serialize this migration because every Swarm replica runs migrate."""
    connection = schema_editor.connection
    if connection.vendor != "mysql":
        return callback()

    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(%s, %s)", [LOCK_NAME, 60])
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise RuntimeError("Could not acquire the redesigned auxiliary-page migration lock")
    try:
        return callback()
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", [LOCK_NAME])


def create_auxiliary_table_if_missing(apps, schema_editor):
    """Create the table on fresh databases; adopt it after an interrupted run."""
    RedesignAuxiliaryPage = apps.get_model(
        "specialfeaturelanding", "RedesignAuxiliaryPage"
    )

    def create_table():
        table_name = RedesignAuxiliaryPage._meta.db_table
        if table_name not in schema_editor.connection.introspection.table_names():
            schema_editor.create_model(RedesignAuxiliaryPage)

    _with_migration_lock(schema_editor, create_table)


def create_redesigned_auxiliary_pages(apps, schema_editor):
    """Create the two CMS pages which own the stable redesigned routes."""
    # Wagtail's historical migration models intentionally omit tree methods
    # such as ``add_child``. The schema has already been created above, so use
    # the runtime classes here for the Wagtail-specific tree/revision work.
    # This keeps the operation idempotent while allowing it to create actual
    # CMS pages rather than bare rows in wagtailcore_page.
    from home.models import HomePage
    from specialfeaturelanding.models import RedesignAuxiliaryPage

    def create_pages():
        home = HomePage.objects.order_by("path").first()
        if home is None:
            return

        pages = (
            {
                "page_kind": "team",
                "title": "Redesigned — Our Team",
                "slug": "redesigned-our-team",
                "display_title": "Our Team",
            },
            {
                "page_kind": "podcast",
                "title": "Redesigned — The Vilest Rag",
                "slug": "redesigned-the-vilest-rag",
                "display_title": "The Vilest Rag",
            },
        )
        for values in pages:
            if RedesignAuxiliaryPage.objects.filter(page_kind=values["page_kind"]).exists():
                continue
            page = RedesignAuxiliaryPage(**values)
            home.add_child(instance=page)
            page.save_revision().publish()

    _with_migration_lock(schema_editor, create_pages)


class Migration(migrations.Migration):

    # This migration creates its table from RunPython so an interrupted Swarm
    # deploy can safely adopt an already-created table. MySQL cannot execute
    # that DDL inside Django's migration transaction.
    atomic = False

    dependencies = [
        ("home", "0049_named_homepage_hero_slots"),
        ("specialfeaturelanding", "0034_speciallandingpage_spotify_episode_url"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[migrations.CreateModel(
                name="RedesignAuxiliaryPage",
                fields=[
                    (
                        "page_ptr",
                        models.OneToOneField(
                            auto_created=True,
                            on_delete=django.db.models.deletion.CASCADE,
                            parent_link=True,
                            primary_key=True,
                            serialize=False,
                            to="wagtailcore.page",
                        ),
                    ),
                    (
                        "page_kind",
                        models.CharField(
                            choices=[("team", "Our Team"), ("podcast", "The Vilest Rag")],
                            editable=False,
                            max_length=20,
                            unique=True,
                        ),
                    ),
                    (
                        "display_title",
                        models.CharField(
                            help_text="The title displayed to readers. The CMS page title stays descriptive for editors.",
                            max_length=100,
                        ),
                    ),
                    (
                        "description",
                        wagtail.fields.RichTextField(blank=True, default=""),
                    ),
                    (
                        "spotify_episode_url",
                        models.URLField(
                            blank=True,
                            default="",
                            help_text="The public Spotify episode URL for the Latest episode player.",
                        ),
                    ),
                    (
                        "featured_media",
                        models.ForeignKey(
                            blank=True,
                            null=True,
                            on_delete=django.db.models.deletion.SET_NULL,
                            related_name="+",
                            to="images.ubysseyimage",
                            verbose_name="hero image",
                        ),
                    ),
                ],
                options={
                    "verbose_name": "Redesigned auxiliary page",
                    "verbose_name_plural": "Redesigned auxiliary pages",
                },
                bases=("wagtailcore.page",),
            )],
        ),
        migrations.RunPython(create_auxiliary_table_if_missing, migrations.RunPython.noop),
        migrations.RunPython(create_redesigned_auxiliary_pages, migrations.RunPython.noop),
    ]
