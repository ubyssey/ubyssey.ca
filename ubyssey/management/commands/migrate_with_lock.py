"""Run Django migrations once when multiple Swarm replicas start together."""

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


LOCK_NAME = "ubyssey_startup_migrate"
LOCK_TIMEOUT_SECONDS = 300


class Command(BaseCommand):
    help = "Run migrations while holding a deployment-wide MySQL advisory lock."

    def handle(self, *args, **options):
        connection = connections["default"]

        # Local SQLite and other non-MySQL development databases do not offer
        # MySQL advisory locks. Their single-process development workflow can
        # use Django's normal migration command directly.
        if connection.vendor != "mysql":
            call_command("migrate", interactive=False)
            return

        with connection.cursor() as cursor:
            cursor.execute("SELECT GET_LOCK(%s, %s)", [LOCK_NAME, LOCK_TIMEOUT_SECONDS])
            acquired = cursor.fetchone()[0]
        if not acquired:
            raise CommandError("Timed out waiting for the deployment migration lock")

        try:
            call_command("migrate", interactive=False)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("SELECT RELEASE_LOCK(%s)", [LOCK_NAME])
