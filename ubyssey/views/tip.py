from django.shortcuts import render, redirect
from django.core.mail import send_mail, EmailMessage
from django.conf import settings

class TipForm(object):

    def email_tip(self, request):
        '''Sends emails to news@ubyssey.ca'''
        if request.method == 'POST':
    
            if len(request.FILES.getlist('files[]')) == 0:
                return render(request, 'error.html', {"code": "400", "description": "Bad request. Must include a file."}, status=400)

            recipient = ['news@ubyssey.ca', 'eic@ubyssey.ca', 'deputymanaging@ubyssey.ca']
            
            body = "Sent anonymously from " + request.META["HTTP_REFERER"] + "\n    - " + "\n   - ".join([file.name for file in request.FILES.getlist('files[]')])

            subject = 'ANONYMOUS TIP: ' + request.FILES.getlist('files[]')[0].name

            if len(request.FILES.getlist('files[]')) > 1:
                subject = subject + f" + {len(request.FILES.getlist('files[]'))} more."

            mail = EmailMessage(
                subject,
                body,
                settings.EMAIL_HOST_USER,
                recipient,
            )

            for file in request.FILES.getlist('files[]'):
                mail.attach(file.name, file.read(), file.content_type)

            mail.send(fail_silently=False)

            return render(request, 'tip-success.html', {}) 

        # Return "Error 405 method not allowed" if not POST request
        return render(request, 'error.html', {"code": "405", "description": request.method + " method not allowed."}, status=405)
