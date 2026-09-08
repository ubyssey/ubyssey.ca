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

    def test_beat_page_renders_its_full_feed_without_the_parent_hero(self):
        matching = StandardArticlePage(title="Campus story", slug="campus-story", category_page=self.beat)
        self.section.add_child(instance=matching)
        matching.save_revision().publish()

        response = self.beat.serve(RequestFactory().get(self.beat.url))
        response.render()

        self.assertNotContains(response, 'class="sr-hero page-shell"')
        self.assertEqual(list(response.context_data["redesign_recent_articles"]), [matching])

    def test_article_suggestions_keep_section_and_beat_rows_distinct(self):
        article = StandardArticlePage(title="Current campus story", slug="current-campus-story", category_page=self.beat)
        self.section.add_child(instance=article)
        article.save_revision().publish()

        for index in range(5):
            related = StandardArticlePage(
                title=f"Campus suggestion {index}",
                slug=f"campus-suggestion-{index}",
                category_page=self.beat,
            )
            self.section.add_child(instance=related)
            related.save_revision().publish()

        suggested = article.get_suggested()["redesign_rows"]

        self.assertEqual(suggested[0]["title"], self.section.title)
        self.assertEqual(suggested[1]["title"], self.beat.title)
        self.assertNotIn(article, suggested[0]["articles"])
        self.assertNotIn(article, suggested[1]["articles"])
        self.assertFalse(
            {story.id for story in suggested[0]["articles"]}
            & {story.id for story in suggested[1]["articles"]}
        )
