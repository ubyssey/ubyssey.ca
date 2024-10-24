from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.conf import settings
from django.shortcuts import render

def custom_500(request):
    return render(request, '500.html', status=500)

def parse_int_or_none(maybe_int):
    try:
        return int(maybe_int)
    except (TypeError, ValueError):
        return None

def ads_txt(request):
    return redirect(settings.ADS_TXT_URL)

def redirect_blog_to_humour(request):
    path = request.get_full_path().replace("/blog/","/humour/")
    return redirect(path)

def publish_scheduled(request):
    from django.http import HttpResponse
    from django.core.management import execute_from_command_line
    try:
        execute_from_command_line(['manage.py', 'publish_scheduled'])
        return HttpResponse("Success!")
    except:
        return HttpResponse("Failed :/", status=500)
     

class UbysseyTheme:
    @staticmethod
    def centennial(request):
        return render(request, 'centennial.html', {})