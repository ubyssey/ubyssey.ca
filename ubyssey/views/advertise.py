from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.conf import settings

class AdvertiseTheme(object):
    """Theme for the advertising microsite."""

    def landing(self, request):
        """Advertising microsite landing page."""

        if request.method == 'POST':
            name = request.POST.get('name')
            email = request.POST.get('email')
            message = request.POST.get('message')

            template = 'Name: %s\nEmail: %s\nMessage:\n%s'

            if name and email:
                send_mail(
                    'Advertising inquiry from %s' % name,
                    template % (name, email, message),
                    email,
                    [settings.UBYSSEY_ADVERTISING_EMAIL],
                    fail_silently=True,
                )

        return render(request, 'advertise/index.html', {})

    def new(self, request):
        """Advertising microsite landing page."""

        if request.method == 'POST':
            name = request.POST.get('name')
            email = request.POST.get('email')
            message = request.POST.get('message')

            template = 'Name: %s\nEmail: %s\nMessage:\n%s'

            if name and email:
                send_mail(
                    'Advertising inquiry from %s' % name,
                    template % (name, email, message),
                    email,
                    [settings.UBYSSEY_ADVERTISING_EMAIL],
                    fail_silently=True,
                )

        return render(request, 'advertise/index.html', {})
