from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse
from django.utils import timezone


def content_tracker(request):
    context = {}
    return render(request, "content_tracker/content_tracker.html", context)