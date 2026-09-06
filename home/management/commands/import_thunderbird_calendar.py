from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from home.sports_calendar import import_calendar


class Command(BaseCommand):
    help = "Import the supplied Thunderbird calendar. Existing editor-entered scores are preserved."

    def add_arguments(self, parser):
        parser.add_argument("--csv", type=Path, required=True, help="Path to thunderbirds_calendar.csv")

    def handle(self, *args, **options):
        source = options["csv"]
        if not source.is_file():
            raise CommandError(f"Calendar not found: {source}")
        result = import_calendar(source)
        self.stdout.write(self.style.SUCCESS(
            f"Imported or refreshed {result['imported']} covered Thunderbird fixtures "
            f"({result['skipped']} rows skipped)."
        ))
