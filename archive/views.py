from django.shortcuts import render

from article.models import ArticlePage
from django.http import HttpResponse
from django.core import serializers
import json
from django.template import loader

def getArticles(filters, start, number):
    articles = ArticlePage.objects.live().public()

    if "section" in filters:
        if filters["section"] == "home":
            return ArticlePage.objects.live().public().order_by('-explicit_published_at')[int(start):int(start)+int(number)]
        else:
            articles = articles.filter(current_section=filters["section"])

    if "category" in filters:
        articles = articles.filter(category__slug=filters["category"])

    if "search_query" in filters:
        return articles.search(filters["search_query"])[int(start):int(start)+int(number)]
    else:
        return articles.order_by('-explicit_published_at')[int(start):int(start)+int(number)]

def infinitefeed(request):
    if request.method == 'GET':
        start = request.GET['start']
        number = request.GET['number']
        mode = request.GET['mode']

        filters = {}

        if "section" in request.GET:
            filters["section"] = request.GET['section']
        if "category" in request.GET:
            filters["category"] = request.GET['category']
        if "search_query" in request.GET:
            filters["search_query"] = request.GET['search_query']

        articles = getArticles(filters, start, number)
        
        if len(articles) == 0:
            return HttpResponse("End of feed")
        else:
            template = loader.select_template(["article/infinitefeed.html"])
            data = {'articles': articles, 'mode': mode}
            return HttpResponse(loader.render_to_string("article/infinitefeed.html", data))
    else:
        return HttpResponse("Request method is not a GET")