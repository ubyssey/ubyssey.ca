import json
from .forms import SubscriberForm
from .models import Subscriber
from .utils import MailchimpService
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseServerError
from django.views.generic import DeleteView, View
from bootstrap_modal_forms.generic import BSModalCreateView

class SubscriberCreateView(BSModalCreateView):
    """
    Class view for creating Subscribers through a form embedded in a bootstrap modal.
    Bootstrap modal and AJAX are intended to let this view to be used as long as a modal can be triggered, without refreshing or redirecting the page, so a user doesn't lose what they were reading.

    TODO: This should be marked something that needs a refactor or redesign; it may be "overdesigned"
    What happens is an email first goes to the site's server for validation, then gets posted to Webchimp.
    Webchimp's webhooks then sync to our db
    """
    form_class = SubscriberForm
    template_name = 'newsletter/subscribe.html'

    def setup(self, request, *args, **kwargs):
        self.mailchimp_service_object = MailchimpService()
        return super().setup(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        """
        POST request is expected to use AJAX and will not redirect user to a different page.
        It gives a backend integrity check for the data before mailchimp gets its hands on it

        This was based on this blog post (for reference): https://realpython.com/django-and-ajax-form-submissions/
        """
        status = 200
        response_data = {} # Dict that will hold stats of the submitted subscriber, or else let us know something odd happened, like a malformed POST request being made to the URL corresponding to this view
        form = self.get_form()
        if form.is_valid():
            response_data['email'] = request.POST.get('email')
            subscriber = Subscriber(email=response_data['email'])
            try:
                # subscriber.save() #Doesn't need to be saved yet, mailchimp will sync with it later
                # response_data['created'] = subscriber.created.strftime('%B %d, %Y %I:%M %p') #consider adding 'created' field so we can tell how old a subscriber is

                self.mailchimp_service_object.add_subscriber_to_list(subscriber=subscriber)
                response_data['result'] = 'Subscriber added!'
            except IntegrityError:
                response_data['result'] = 'IntegrityError. Check whether this email is already in the mailing list, or else whether it is properly formed!'
                status = 400                     
            except ValidationError:
                response_data['result'] = "ValidationError"
                status = 400
        else:
            response_data['result'] = 'form.is_valid() check failed!'            
            status = 400
        return HttpResponse(
            json.dumps(response_data),
            content_type="application/json",
            status=status
        )

class SubscriberDeleteView(DeleteView):
    form_class = SubscriberForm

class WebhookResponseHandlerView(View):    
    """
    Responds to webhook requests sent by Mailchimp; keeps their db in sync with ours

    Based on https://mailchimp.com/developer/guides/sync-audience-data-with-webhooks/, adapting Flask to Django
    """
    def post(self, request, *args, **kwards):
        response_data = {}
        json_data = json.loads(request.body) #loads = 'load string'
        try:
            request_type = json_data['type'] #should be 'subscribe' or 'unsubscribe'. Set which request types will occur on Mailchimp's Audience settings
            request_data = json_data['data'] #should be another json dict
            subscriber = Subscriber(email=request_data['email'])
            response_data['subscriberpk'] = subscriber.pk
            response_data['email'] = subscriber.email

            if request_type == 'unsubscribe':
                subscriber.delete()
                response_data['result'] = 'Subscriber deleted!'

            elif request_type == 'subscribe':
                subscriber.full_clean() #integrity check                
                subscriber.save()
                response_data['result'] = 'Subscriber added!'
            return HttpResponse(
                json.dumps(response_data),
                content_type="application/json"
            )
            
        except KeyError:
            response_data['result'] = 'Malformed data!'
            return HttpResponseServerError(
                json.dumps(response_data),
                content_type="application/json"
            )

