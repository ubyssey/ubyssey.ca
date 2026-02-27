# Generated migration to fix Wagtail upgrade issue
# This migration adds the missing CHECK constraint that Wagtail 7.0 migration expects to exist
#
# Issue: wagtailcore.0090_remove_grouppagepermission_permission_type fails because
# it tries to remove a constraint that was never created in earlier migrations

from django.db import migrations


def add_constraint_if_missing(apps, schema_editor):
    """
    Add the CHECK constraint if it doesn't exist.
    This ensures that Wagtail's 0090 migration can successfully remove it.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if constraint exists
        cursor.execute("""
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'wagtailcore_grouppagepermission'
            AND CONSTRAINT_NAME = 'permission_or_permission_type_not_null'
        """)

        constraint_exists = cursor.fetchone() is not None

        if not constraint_exists:
            print("Adding missing constraint: permission_or_permission_type_not_null")
            # Add the constraint that Wagtail expects
            # This constraint ensures either permission or permission_type is not null
            cursor.execute("""
                ALTER TABLE wagtailcore_grouppagepermission
                ADD CONSTRAINT permission_or_permission_type_not_null
                CHECK (
                    (permission_id IS NOT NULL AND permission_type IS NULL)
                    OR (permission_id IS NULL AND permission_type IS NOT NULL)
                )
            """)
            print("✓ Successfully added constraint")
        else:
            print("✓ Constraint already exists, skipping")


def reverse_migration(apps, schema_editor):
    """
    Reverse migration - remove the constraint if we added it.
    Note: In practice, this won't be needed since Wagtail's 0090 will remove it.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if constraint exists
        cursor.execute("""
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'wagtailcore_grouppagepermission'
            AND CONSTRAINT_NAME = 'permission_or_permission_type_not_null'
        """)

        constraint_exists = cursor.fetchone() is not None

        if constraint_exists:
            cursor.execute("""
                ALTER TABLE wagtailcore_grouppagepermission
                DROP CONSTRAINT permission_or_permission_type_not_null
            """)
            print("✓ Removed constraint during rollback")


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0037_alter_homepage_curated_stream_and_more'),
        # This must run BEFORE Wagtail's problematic migration
        ('wagtailcore', '0089_log_entry_data_json'),
    ]

    operations = [
        migrations.RunPython(
            add_constraint_if_missing,
            reverse_migration,
        ),
    ]
