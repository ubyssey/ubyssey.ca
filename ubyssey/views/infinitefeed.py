from article.models import ArticlePage
from django.http import HttpResponse

def infinitefeed(request):
    if request.method == 'GET':
            section = request.GET['section']
            start = request.GET['start']
            number = request.GET['number']
            articles = ArticlePage.objects.live().public().filter(current_section=section).order_by('-explicit_published_at')[int(start):int(start+number)]
            data = []
            for article in articles:
                data.append({"name": article.title, "author": article.authors_string})
            return HttpResponse(data) # Sending an success response
    else:
           return HttpResponse("Request method is not a GET")