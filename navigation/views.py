from django.shortcuts import render
from django.db.models import Q

from wagtail.models import Site
from wagtail.search.query import Phrase, PlainText

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import serializers

from article.models import ArticlePage, ArticleTopic
from authors.models import AuthorPage

class ArticleNavSearchSerializer(serializers.ModelSerializer):
    title = serializers.CharField()
    url = serializers.URLField(source="get_url")
    datetime = serializers.DateTimeField(source="explicit_published_at")

    class Meta:
        model = ArticlePage
        fields = ('title', 'url', 'datetime')

class TopicNavSearchSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='name')
    url = serializers.URLField(source="get_relative_url")
    datetime = serializers.DateTimeField(source="last_tagged_at")

    class Meta:
        model = ArticleTopic
        fields = ('title', 'url', 'datetime')

class AuthorsNavSearchSerializer(serializers.ModelSerializer):
    title = serializers.CharField()
    url = serializers.URLField(source="get_url")

    class Meta:
        model = ArticlePage
        fields = ('title', 'url')

# Create your views here.

@api_view(['GET'])
def nav_search(request):
    """
    List all code snippets, or create a new snippet.
    """

    MAX_ARTICLES = 5
    MAX_AUTHORS = 3

    if request.method == 'GET':
        if 'q' in request.query_params:
            query = request.query_params["q"]
            site =  Site.find_for_request(request)

            # Topics
            topics = ArticleTopic.objects.filter(name__icontains = query).order_by("-relevance_score")[:3]
            topics_serialized = TopicNavSearchSerializer(topics, many=True)

            # Articles
            articles = ArticlePage.objects.live().public().descendant_of(site.root_page)
            articles = ArticlePage.objects.custom_search(articles, query, site=site, max_articles=MAX_ARTICLES)
            articles_serialized = ArticleNavSearchSerializer(articles, many=True)
            
            # Authors
            authors = AuthorPage.objects.live().filter(Q(title__istartswith=query) | Q(title__icontains=" " + query)).order_by("-last_activity")
            authors = authors[:MAX_AUTHORS]
            authors_serialized = AuthorsNavSearchSerializer(authors, many=True)

            return Response({
                "topics": topics_serialized.data,
                "articles": articles_serialized.data,
                "authors": authors_serialized.data,
                })
        else:
            return render(request, '404.html', {}, status=404) 