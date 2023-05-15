from article.models import ArticlePage
from django.http import HttpResponse
from django.core import serializers
import json
def infinitefeed(request):
    if request.method == 'GET':
        section = request.GET['section']
        start = request.GET['start']
        number = request.GET['number']
        articles = ArticlePage.objects.live().public().filter(current_section=section).order_by('-explicit_published_at')[int(start):int(start)+int(number)]
        if len(articles) == 0:
             return HttpResponse("End of feed")
        else:
            data = []
            for article in articles:
                data.append({"name": article.title, "author": article.authors_string})
            response = {}
            response['result'] = data
            return HttpResponse(json.dumps(response), content_type="application/json")
    else:
           return HttpResponse("Request method is not a GET")