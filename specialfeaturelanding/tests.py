from types import SimpleNamespace

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from authors.models import AuthorPage
from specialfeaturelanding.models import RedesignTeamMember


class TeamMemberEmailTests(SimpleTestCase):
    def test_roster_override_does_not_change_author_profile_email(self):
        author = AuthorPage(full_name="Test Author", contact_email="author@ubyssey.ca")
        member = RedesignTeamMember(author=author, email_override="team@ubyssey.ca")
        self.assertEqual(member.public_email, "team@ubyssey.ca")
        self.assertEqual(author.public_contact_email, "author@ubyssey.ca")

        member.email_override = ""
        self.assertEqual(member.public_email, "author@ubyssey.ca")

    def test_team_card_and_contact_row_use_the_same_override(self):
        author = SimpleNamespace(
            full_name="Test Author",
            ubyssey_role="Editor",
            public_contact_email="author@ubyssey.ca",
            redesign_contact_email="",
            preview_url="/authors/test-author/",
            preview_image="",
            image=None,
            pronouns="",
            short_bio_description="",
        )
        for template_name in (
            "support/partials/person.html",
            "support/partials/contact_row.html",
        ):
            with self.subTest(template=template_name):
                html = render_to_string(
                    template_name,
                    {"person": author, "override_email": "team@ubyssey.ca"},
                )
                self.assertIn('href="mailto:team@ubyssey.ca"', html)
                self.assertNotIn('href="mailto:author@ubyssey.ca"', html)
