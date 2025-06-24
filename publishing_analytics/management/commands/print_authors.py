from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        authors = AuthorPage.objects.all()

        for author in authors:
            print(author.full_name)
            articles = ArticlePage.objects.filter(article_authors__author=author).order_by("-explicit_published_at")
            #for article in articles:
            #    print(" - " + article.title)
            num_articles = len(articles)
            lifespan = articles[-1].explicit_published_at - articles[0].explicit_published_at