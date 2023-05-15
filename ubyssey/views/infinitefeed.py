from article.models import ArticlePage
from django.http import HttpResponse
from django.core import serializers
import json
from django.template import loader
def infinitefeed(request):
    if request.method == 'GET':
        section = request.GET['section']
        start = request.GET['start']
        number = request.GET['number']
        articles = ArticlePage.objects.live().public().filter(current_section=section).order_by('-explicit_published_at')[int(start):int(start)+int(number)]
        
        if len(articles) == 0:
            return HttpResponse("End of feed")
        else:
            template = loader.select_template(["article/infinitefeed.html"])
            data = {'articles': articles}
            return HttpResponse(loader.render_to_string("article/infinitefeed.html", data))
    else:
            return HttpResponse("Request method is not a GET")