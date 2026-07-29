from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from wagtail.models import Page, Site

from home.models import HomePage
from join.models import (
    JoinApplicationStep,
    JoinLandingPage,
    JoinPosition,
    JoinUnitPage,
)


class JoinPageTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.get_first_root_node()
        # Wagtail's initial migration already creates a root child with the
        # ``home`` slug, so use a distinct fixture slug.
        cls.home = HomePage(title="Home", slug="test-home")
        root.add_child(instance=cls.home)
        Site.objects.update_or_create(
            is_default_site=True,
            defaults={
                "hostname": "localhost",
                "port": 80,
                "root_page": cls.home,
                "site_name": "The Ubyssey",
            },
        )

        cls.landing = JoinLandingPage(
            title="Join",
            slug="join",
            introduction="<p>Volunteer with The Ubyssey.</p>",
            application_form_url="https://example.com/apply",
        )
        cls.home.add_child(instance=cls.landing)
        JoinApplicationStep.objects.create(
            page=cls.landing,
            sort_order=0,
            title="Attend an Information Session",
            description="Register for and attend an information session.",
        )
        cls.landing.save_revision().publish()

        cls.unit = JoinUnitPage(
            title="Sports",
            slug="sports",
            category=JoinUnitPage.CATEGORY_REPORTAGE,
            unit_type="Section",
            card_description="Cover varsity and recreation at UBC.",
            introduction="<p>Report on UBC sport.</p>",
        )
        cls.landing.add_child(instance=cls.unit)
        cls.unit.save_revision().publish()
        cls.unit._join_landing = cls.landing

    def test_position_availability_requires_toggle_and_shared_form_url(self):
        closed = JoinPosition(
            page=self.unit,
            title="Closed role",
            description="<p>Description</p>",
            accepting_applications=False,
        )
        open_position = JoinPosition(
            page=self.unit,
            title="Open role",
            description="<p>Description</p>",
            accepting_applications=True,
        )

        self.assertFalse(closed.is_accepting_applications)
        self.assertTrue(open_position.is_accepting_applications)
        self.assertEqual(
            open_position.resolved_application_url,
            self.landing.application_form_url,
        )

        self.landing.application_form_url = ""
        self.assertFalse(open_position.is_accepting_applications)
        self.landing.application_form_url = "https://example.com/apply"

    def test_unit_is_open_when_form_exists_and_any_position_is_toggled_open(self):
        self.unit.positions.create(
            title="Closed role",
            description="<p>Description</p>",
            accepting_applications=False,
        )
        self.assertFalse(self.unit.is_accepting_applications)

        self.unit.positions.create(
            title="Open role",
            description="<p>Description</p>",
            accepting_applications=True,
        )
        self.assertTrue(self.unit.is_accepting_applications)

        self.landing.application_form_url = ""
        self.assertFalse(self.unit.is_accepting_applications)
        self.landing.application_form_url = "https://example.com/apply"

    def test_landing_card_links_to_unit_even_when_closed(self):
        response = self.client.get("/join/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href="/join/sports/"')
        self.assertContains(response, "Not Accepting Applications")

    def test_application_process_is_rendered_and_linked_from_navigation(self):
        response = self.client.get("/join/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href="#application-process"')
        self.assertContains(
            response,
            'href="/join/#application-process"',
        )
        self.assertContains(response, "Attend an Information Session")

    def test_all_positions_render_as_accordions_but_only_open_roles_link_out(self):
        self.unit.positions.create(
            title="Closed role",
            description="<p>Closed description</p>",
            accepting_applications=False,
        )
        self.unit.positions.create(
            title="Open role",
            description="<p>Open description</p>",
            accepting_applications=True,
        )
        self.unit.save_revision().publish()

        response = self.client.get("/join/sports/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-join-accordion", count=2)
        self.assertContains(response, "Closed description")
        self.assertContains(response, "Open description")
        self.assertContains(response, 'href="https://example.com/apply"', count=1)

    def test_page_type_hierarchy_matches_join_routes(self):
        self.assertEqual(JoinLandingPage.parent_page_types, ["home.HomePage"])
        self.assertEqual(JoinLandingPage.subpage_types, ["join.JoinUnitPage"])
        self.assertEqual(JoinUnitPage.parent_page_types, ["join.JoinLandingPage"])
        self.assertEqual(JoinUnitPage.subpage_types, [])


class SeedJoinPagesCommandTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.get_first_root_node()
        cls.home = HomePage(title="Seed Home", slug="seed-home")
        root.add_child(instance=cls.home)
        Site.objects.update_or_create(
            is_default_site=True,
            defaults={
                "hostname": "localhost",
                "port": 80,
                "root_page": cls.home,
                "site_name": "The Ubyssey",
            },
        )

    def run_seed(self, **options):
        output = StringIO()
        call_command("seed_join_pages", stdout=output, **options)
        return output.getvalue()

    def test_seed_creates_complete_published_tree_without_external_form_url(self):
        self.run_seed()

        landing = JoinLandingPage.objects.get(slug="join")
        units = JoinUnitPage.objects.child_of(landing)

        self.assertTrue(landing.live)
        self.assertEqual(landing.application_form_url, "")
        self.assertEqual(landing.application_steps.count(), 3)
        self.assertEqual(landing.faqs.count(), 5)
        self.assertEqual(landing.career_stages.count(), 5)
        self.assertEqual(units.count(), 14)
        self.assertEqual(
            JoinPosition.objects.filter(page__in=units).count(),
            63,
        )
        self.assertFalse(units.filter(live=False).exists())

    def test_seed_is_idempotent_without_sync(self):
        self.run_seed()
        landing = JoinLandingPage.objects.get(slug="join")
        landing.hero_heading = "CMS-edited heading"
        landing.save_revision().publish()

        output = self.run_seed()

        landing.refresh_from_db()
        self.assertEqual(landing.hero_heading, "CMS-edited heading")
        self.assertEqual(JoinLandingPage.objects.filter(slug="join").count(), 1)
        self.assertEqual(JoinUnitPage.objects.child_of(landing).count(), 14)
        self.assertIn("unchanged", output)

    def test_sync_restores_canonical_content_and_sets_explicit_form_url(self):
        self.run_seed()
        landing = JoinLandingPage.objects.get(slug="join")
        landing.hero_heading = "CMS-edited heading"
        landing.save_revision().publish()

        self.run_seed(
            sync=True,
            application_form_url="https://example.com/staging-apply",
        )

        landing.refresh_from_db()
        self.assertEqual(landing.hero_heading, "Join The Ubyssey")
        self.assertEqual(
            landing.application_form_url,
            "https://example.com/staging-apply",
        )
        open_positions = JoinPosition.objects.filter(
            page__in=JoinUnitPage.objects.child_of(landing),
            accepting_applications=True,
        )
        self.assertEqual(open_positions.count(), 3)

    def test_dry_run_rolls_back_initialization(self):
        output = self.run_seed(dry_run=True)

        self.assertFalse(JoinLandingPage.objects.filter(slug="join").exists())
        self.assertIn("rolled back", output)
