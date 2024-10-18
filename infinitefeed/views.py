from django.shortcuts import render

from article.models import ArticlePage
from django.http import HttpResponse
from django.core import serializers
import json
from django.template import loader
from section.models import SectionPage
from django.http import JsonResponse

def getArticles(filters, start, number):

    if "section" in filters and not "category" in filters:
        if filters["section"] == "home":
            return ArticlePage.objects.live().public().order_by('-explicit_published_at')[int(start):int(start)+int(number)]
        else:
            section = SectionPage.objects.get(slug=filters["section"])
            articles = ArticlePage.objects.live().public().descendant_of(section).order_by('-explicit_published_at')
    else:
        articles = ArticlePage.objects.live().public().order_by('-explicit_published_at')

    if "tag" in filters:
        articles = articles.filter(tags__slug=filters["tag"])

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

        filters = {}

        if "section" in request.GET:
            filters["section"] = request.GET['section']
        if "tag" in request.GET:
            filters["tag"] = request.GET['tag']
        if "category" in request.GET:
            filters["category"] = request.GET['category']
        if "search_query" in request.GET:
            filters["search_query"] = request.GET['search_query']

        articles = getArticles(filters, start, number)

        if len(articles) == 0:
            return HttpResponse("End of feed")
        else:
            articleHtml = []
            for article in articles:
                data = {'article': article}
                if "label" in request.GET:
                    data["label"] = True
                if "section" in request.GET:
                    data["expectedSection"] = request.GET['section']
                articleHtml.append(loader.render_to_string("article/objects/infinitefeed_item.html", data))
                   
            articleHtml_json = json.dumps(articleHtml)
            return HttpResponse(articleHtml_json, content_type ="application/json")
    else:
        return HttpResponse("Request method is not a GET")