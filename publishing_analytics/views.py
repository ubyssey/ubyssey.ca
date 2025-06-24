from django.shortcuts import render
from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

# Create your views here.
def author_publish_frequency(request):
    authors = AuthorPage.objects.all()

    for author in authors:
        articles = ArticlePage.objects.filter(authors=author).order_by("-article_page__explicit_published_at")
