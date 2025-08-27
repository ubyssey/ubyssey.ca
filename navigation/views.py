from django.shortcuts import render

from wagtail.models import Site
from wagtail.search.query import Phrase, PlainText

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import serializers

from article.models import ArticlePage, ArticleTopic

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
    datetime = serializers.DateTimeField(source="last_used_at")

    class Meta:
        model = ArticleTopic
        fields = ('title', 'url', 'datetime')

# Create your views here.

@api_view(['GET'])
def nav_search(request):
    """
    List all code snippets, or create a new snippet.
    """

    MAX_ARTICLES = 5

    if request.method == 'GET':
        if 'q' in request.query_params:
            query = request.query_params["q"]

            topics = ArticleTopic.objects.filter(name__icontains = query).order_by("-tagged_articles_count")[:3]
            topics_serialized = TopicNavSearchSerializer(topics, many=True)

            site =  Site.find_for_request(request)
            
            articles = ArticlePage.objects.live().public().descendant_of(site.root_page).filter(title__icontains=query).order_by("-explicit_published_at")
            if articles.count() < MAX_ARTICLES:
                articles = ArticlePage.objects.live().public().descendant_of(site.root_page).search(Phrase(query) | PlainText(query))
            articles = articles[:MAX_ARTICLES]
            
            articles_serialized = ArticleNavSearchSerializer(articles, many=True)

            return Response({
                "topics": topics_serialized.data,
                "articles": articles_serialized.data,
                "authors": [],
                })