import json
from .forms import SubscriberForm
from .models import Subscriber
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import View, TemplateView
from bootstrap_modal_forms.generic import BSModalCreateView

class SubscriberCreateView(BSModalCreateView):
    form_class = SubscriberForm
    template_name = 'newsletter/subscribe.html'
    # success_message = 'Success! Thank you for subscribing!'
    # success_url = reverse_lazy('success')

    def post(self, request, *args, **kwards):
        response_data = {} #dict that will hold stats of the submitted subscriber
        form = self.get_form()
        if form.is_valid():
            subscribers_email = request.POST.get('email')        
            subscriber = Subscriber(email=subscribers_email)
            subscriber.save()

            response_data['result'] = 'Subscriber added!'
            response_data['subscriberpk'] = subscriber.pk
            response_data['email'] = subscriber.email
            # response_data['created'] = subscriber.created.strftime('%B %d, %Y %I:%M %p') #consider adding 'created' field so we can tell how old a subscriber is
        else:
            response_data['result'] = 'form.is_valid() check failed!'
        return HttpResponse(
            json.dumps(response_data),
            content_type="application/json"
        )
