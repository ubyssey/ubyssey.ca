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

class UbysseyTheme:
    @staticmethod
    def centennial(request):
        return render(request, 'centennial.html', {})

def update_events(request):
    from urllib.request import urlopen
    from icalendar import Calendar, Event
    try:
        cal = urlopen("https://events.ubc.ca/events/?ical=1")

        cal = Calendar.from_ical(cal.read())
        for component in cal.walk():
            if component.name == "VEVENT":
                print(component.get('summary'))
                print(component.get('dtstart'))
                print(component.get('dtend'))
                print(component.get('dtstamp'))
        
        return HttpResponse("Success!")
    except:
        return HttpResponse("Failed :/", status=500)