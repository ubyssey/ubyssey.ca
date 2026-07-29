from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from wagtail.models import Site

from home.models import HomePage
from join.models import (
    JoinApplicationStep,
    JoinCareerStage,
    JoinFAQ,
    JoinLandingPage,
    JoinPosition,
    JoinUnitPage,
)
from join.seed_data import (
    APPLICATION_STEPS,
    CAREER_DESCRIPTION,
    CAREER_STAGES,
    FAQS,
    LANDING,
    unit_data,
)


class Command(BaseCommand):
    help = (
        "Create the canonical /join/ Wagtail page tree. Existing pages are "
        "left unchanged unless --sync is supplied."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Update existing join pages and replace their inline content.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report changes, then roll back the transaction.",
        )
        parser.add_argument(
            "--application-form-url",
            default="",
            help=(
                "Environment-specific shared application form URL. It defaults "
                "to blank so preview links are never seeded into production."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        sync = options["sync"]
        dry_run = options["dry_run"]
        application_form_url = options["application_form_url"].strip()
        home = self._get_home_page()

        landing = (
            JoinLandingPage.objects.child_of(home)
            .filter(slug=LANDING["slug"])
            .first()
        )
        landing_created = landing is None
        if landing_created:
            landing = JoinLandingPage(
                **LANDING,
                application_form_url=application_form_url,
            )
            home.add_child(instance=landing)
            self._replace_landing_inline_content(landing)
            landing.save_revision().publish()
            self.stdout.write(self.style.SUCCESS("Created /join/ landing page."))
        elif sync:
            self._set_fields(
                landing,
                {
                    **LANDING,
                    "application_form_url": application_form_url,
                },
            )
            self._replace_landing_inline_content(landing)
            landing.save_revision().publish()
            self.stdout.write(self.style.SUCCESS("Synchronized /join/ landing page."))
        else:
            self.stdout.write("Kept existing /join/ landing page unchanged.")

        created_units = 0
        synced_units = 0
        kept_units = 0
        for spec in unit_data():
            unit = (
                JoinUnitPage.objects.child_of(landing)
                .filter(slug=spec["slug"])
                .first()
            )
            unit_created = unit is None
            page_fields = {
                key: value for key, value in spec.items() if key != "positions"
            }
            if unit_created:
                unit = JoinUnitPage(**page_fields)
                landing.add_child(instance=unit)
                self._replace_positions(unit, spec["positions"])
                unit.save_revision().publish()
                created_units += 1
            elif sync:
                self._set_fields(unit, page_fields)
                self._replace_positions(unit, spec["positions"])
                unit.save_revision().publish()
                synced_units += 1
            else:
                kept_units += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Join units: {created_units} created, {synced_units} "
                f"synchronized, {kept_units} unchanged."
            )
        )

        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(
                self.style.WARNING(
                    "Dry run complete; all database changes rolled back."
                )
            )

    def _get_home_page(self):
        try:
            root_page = Site.objects.get(is_default_site=True).root_page.specific
        except Site.DoesNotExist as error:
            raise CommandError("No default Wagtail site is configured.") from error

        if isinstance(root_page, HomePage):
            return root_page

        home = (
            HomePage.objects.descendant_of(root_page, inclusive=True)
            .order_by("path")
            .first()
        )
        if home is None:
            raise CommandError(
                "The default Wagtail site does not contain a HomePage parent."
            )
        return home

    @staticmethod
    def _set_fields(instance, values):
        for field, value in values.items():
            setattr(instance, field, value)

    @staticmethod
    def _replace_landing_inline_content(landing):
        landing.application_steps.all().delete()
        landing.faqs.all().delete()
        landing.career_stages.all().delete()

        for sort_order, values in enumerate(APPLICATION_STEPS):
            JoinApplicationStep.objects.create(
                page=landing,
                sort_order=sort_order,
                **values,
            )
        for sort_order, values in enumerate(FAQS):
            JoinFAQ.objects.create(
                page=landing,
                sort_order=sort_order,
                **values,
            )
        for sort_order, values in enumerate(CAREER_STAGES):
            JoinCareerStage.objects.create(
                page=landing,
                sort_order=sort_order,
                description=CAREER_DESCRIPTION,
                **values,
            )

    @staticmethod
    def _replace_positions(unit, positions):
        unit.positions.all().delete()
        for sort_order, values in enumerate(positions):
            JoinPosition.objects.create(
                page=unit,
                sort_order=sort_order,
                **values,
            )
