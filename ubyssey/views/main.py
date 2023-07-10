from django.shortcuts import render, redirect
from django.conf import settings

def parse_int_or_none(maybe_int):
    try:
        return int(maybe_int)
    except (TypeError, ValueError):
        return None

def ads_txt(request):
    return redirect(settings.ADS_TXT_URL)

class UbysseyTheme:
    @staticmethod
    def centennial(request):
        return render(request, 'centennial.html', {})
