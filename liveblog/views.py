from django.shortcuts import render

# Create your views here.

from django.http import HttpResponse
from django.utils import timezone

from liveblog.models import LiveBlogArticlePage

def liveblog_admin(request, id):
    page = LiveBlogArticlePage.objects.filter(id=id).first()

    if page == None:
        return render(request, '404.html', {}, status=404)

    return render(request, "liveblog/liveblog_admin_page.html", page.get_admin_context(request))