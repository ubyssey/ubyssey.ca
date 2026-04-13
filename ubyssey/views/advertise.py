from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.conf import settings
import os

class AdvertiseTheme(object):
    """Theme for the advertising microsite."""

    def new(self, request):
        """Advertising microsite landing page."""

        if request.method == 'POST':
            name    = request.POST.get('name')
            email   = request.POST.get('email')
            message = request.POST.get('message')
            cart    = request.POST.get('cart')
            trap    = request.POST.get('trap')

            fields_content = [
                ["Name", name], 
                ["Email", email],
                ["Cart", cart],
                ["Message", message],
                ["Trap text", trap],
            ]

            fields_content = filter(lambda field: not field[1] in ['', None], fields_content)
            fields_content = map(lambda field: f'{field[0]}: {field[1]}', fields_content)
            fields_content = "\n".join(fields_content)

            content = f'THIS EMAIL IS FROM noreply@ubyssey.ca. TO FOLLOW UP THIS INQUIRY, CONTACT THE EMAIL ADDRESS BELOW\n\n{fields_content}\n\nSent from https://ubyssey.ca/advertise/#contact.\nDo not reply.'

            blacklist = ['testing@example.com']

            if name and email:
                if email not in blacklist:
                    if trap in ['', None]:
                        # This is a dumb way to filter out bots. The input is inaccessible to a regular user, so should be empty.
                        recipient = [settings.UBYSSEY_ADVERTISING_EMAIL]
                    else:
                        # If the trap field has content, send to webmaster email so that we have logs of this activity
                        #recipient = [settings.UBYSSEY_WEBMASTER_EMAIL]
                        # Actually don't do this cause gmail has a cap on frequency of authentications
                        pass
                    
                    send_mail(
                        'Advertising inquiry from %s' % name,
                        content,
                        settings.EMAIL_HOST_USER,
                        recipient,
                        fail_silently=False,
                    )


        return render(request, 'advertise/index.html', {})
