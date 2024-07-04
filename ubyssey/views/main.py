from django.shortcuts import render, redirect
from django.conf import settings
from django.shortcuts import render
from django.conf import settings
from django.shortcuts import render
from images.models import UbysseyImage

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

def get_image_urls(request):
    images = UbysseyImage.objects.all()  # Fetch all UbysseyImage instances
    base_url = settings.MEDIA_URL  # Access the MEDIA_URL setting
    image_urls = []

    for image in images:
        url = request.build_absolute_uri(base_url + image.file.name)
        image_urls.append(url)
        print(url)  # Print each URL to the console

    # Pass image_urls to OpenAI API or render them in a template if needed
    return render(request, 'centennial.html', {})

class UbysseyTheme:
    @staticmethod
    def centennial(request):
        return render(request, 'centennial.html', {})
