"""
Locust load testing configuration for ubyssey.ca

Usage:
  # Run locally against staging
  locust --host=https://staging.ubyssey.ca

  # Run with specific users and spawn rate
  locust --host=https://staging.ubyssey.ca --users 100 --spawn-rate 10

  # Run headless (no web UI)
  locust --host=https://staging.ubyssey.ca --users 100 --spawn-rate 10 --run-time 5m --headless
"""

from locust import HttpUser, task, between
import random


class UbysseyUser(HttpUser):
    """
    Simulates a typical Ubyssey reader browsing the website
    """

    # Wait between 1-5 seconds between tasks (simulating reading time)
    wait_time = between(1, 5)

    def on_start(self):
        """Called when a user starts - simulates landing on homepage"""
        self.client.get("/")

    @task(10)
    def view_homepage(self):
        """View homepage - most common action (weight: 10)"""
        self.client.get("/")

    @task(5)
    def view_section(self):
        """View a section page (weight: 5)"""
        sections = ["news", "culture", "sports", "opinion", "features", "science"]
        section = random.choice(sections)
        self.client.get(f"/{section}/")

    @task(3)
    def view_article(self):
        """View an article - simulated (weight: 3)"""
        # In a real scenario, you'd fetch actual article URLs
        # For now, we'll just hit a few known patterns
        self.client.get("/", name="/articles/[slug]")

    @task(2)
    def search(self):
        """Perform a search (weight: 2)"""
        search_terms = ["UBC", "student", "campus", "housing", "tuition"]
        term = random.choice(search_terms)
        self.client.get(f"/search/?q={term}")

    @task(1)
    def view_authors(self):
        """View authors page (weight: 1)"""
        self.client.get("/authors/")

    @task(1)
    def view_archive(self):
        """View archive (weight: 1)"""
        self.client.get("/archive/")

    @task(1)
    def view_static_page(self):
        """View static pages like about/contact (weight: 1)"""
        pages = ["about", "contact", "advertise"]
        page = random.choice(pages)
        self.client.get(f"/{page}/", name="/static-pages")

    @task(1)
    def health_check(self):
        """Health check endpoint (weight: 1)"""
        self.client.get("/health/")


class MobileUser(HttpUser):
    """
    Simulates mobile users with different browsing patterns
    Mobile users tend to view fewer pages per session
    """

    wait_time = between(2, 6)

    def on_start(self):
        """Mobile users often land on specific articles from social media"""
        self.client.get("/")

    @task(5)
    def quick_browse_homepage(self):
        """Quick homepage view"""
        self.client.get("/")

    @task(3)
    def view_article_from_social(self):
        """Direct article view (from social media link)"""
        self.client.get("/", name="/articles/[slug]-social")

    @task(1)
    def search_mobile(self):
        """Search on mobile"""
        terms = ["events", "clubs", "residence"]
        term = random.choice(terms)
        self.client.get(f"/search/?q={term}")


class BotUser(HttpUser):
    """
    Simulates bot/crawler traffic (Google, social media crawlers)
    """

    wait_time = between(0.5, 2)

    @task(5)
    def crawl_homepage(self):
        """Bots frequently crawl homepage"""
        self.client.get("/", headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"})

    @task(3)
    def crawl_sitemap(self):
        """Bots check sitemap"""
        self.client.get("/sitemap.xml")

    @task(2)
    def crawl_robots(self):
        """Bots check robots.txt"""
        self.client.get("/robots.txt")

    @task(1)
    def crawl_articles(self):
        """Bots crawl article pages"""
        self.client.get("/", name="/articles/[slug]-bot")
