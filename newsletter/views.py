import json
# from .models import Subscriber
from django.http import HttpResponse, HttpResponseServerError
from django.shortcuts import redirect
from django.views.generic import View

def mailchimp_landing_redirect(self):
    response = redirect('https://mailchi.mp/811f064f8f4f/newsletter')
    return response

# class WebhookResponseHandlerView(View):    
#     """
#     Responds to webhook requests sent by Mailchimp; keeps our databases in sync

#     Based on https://mailchimp.com/developer/guides/sync-audience-data-with-webhooks/, adapting Flask to Django
#     """
#     def post(self, request, *args, **kwards):
#         response_data = {}
#         json_data = json.loads(request.body) #loads = 'load string'
#         try:
#             request_type = json_data['type'] #should be 'subscribe' or 'unsubscribe'. Set which request types will occur on Mailchimp's Audience settings
#             request_data = json_data['data'] #should be another json dict
#             subscriber = Subscriber(email=request_data['email'])
#             response_data['subscriberpk'] = subscriber.pk
#             response_data['email'] = subscriber.email

#             if request_type == 'unsubscribe':
#                 subscriber.delete()
#                 response_data['result'] = 'Subscriber deleted!'

#             elif request_type == 'subscribe':
#                 subscriber.full_clean() #integrity check                
#                 subscriber.save()
#                 response_data['result'] = 'Subscriber added!'
#             return HttpResponse(
#                 json.dumps(response_data),
#                 content_type="application/json"
#             )            
#         except KeyError:
#             response_data['result'] = 'Malformed data!'
#             return HttpResponseServerError(
#                 json.dumps(response_data),
#                 content_type="application/json"
#             )
#         except Exception:
#             response_data['result'] = 'Received well formed data, but something still went wrong!!'
#             return HttpResponseServerError(
#                 json.dumps(response_data),
#                 content_type="application/json"
#             )

