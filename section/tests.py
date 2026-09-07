from django.test import RequestFactory, TestCase
from wagtail.models import Page, Site

from article.models import StandardArticlePage
from home.models import HomePage
from section.models import CategoryMenuItem, CategoryPage, SectionPage


class RedesignBeatPageTests(TestCase):
    """Regression coverage for the category URLs used by section beat tabs."""

    def setUp(self):
        root = Page.get_first_root_node()
        self.home = HomePage(title="Test home", slug="test-home")
        root.add_child(instance=self.home)
        self.home.save_revision().publish()

        Site.objects.update(is_default_site=False)
        Site.objects.create(hostname="testserver", port=80, root_page=self.home, is_default_site=True)

        self.section = SectionPage(title="News", slug="news")
        self.home.add_child(instance=self.section)
        self.section.save_revision().publish()

        self.beat = CategoryPage(title="Campus", slug="campus")
        self.section.add_child(instance=self.beat)
        self.beat.save_revision().publish()
        CategoryMenuItem.objects.create(section=self.section, category_page=self.beat)

    def test_beat_page_uses_parent_configuration_and_renders(self):
        request = RequestFactory().get(self.beat.url)
        response = self.beat.serve(request)
        response.render()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context_data["redesign_config"].pk, self.section.pk)
        self.assertEqual(response.context_data["redesign_active_beat_id"], self.beat.pk)
        self.assertEqual(response.context_data["redesign_all_url"], self.section.url)

    def test_beat_feed_only_contains_articles_assigned_to_that_beat(self):
        matching = StandardArticlePage(title="Campus story", slug="campus-story", category_page=self.beat)
        self.section.add_child(instance=matching)
        matching.save_revision().publish()

        other = StandardArticlePage(title="Section story", slug="section-story")
        self.section.add_child(instance=other)
        other.save_revision().publish()

        self.assertEqual(list(self.beat.get_section_articles()), [matching])
