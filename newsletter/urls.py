# newsletter/urls.py

from django.urls import path
from . import views

app_name = 'newsletter'
urlpatterns = [
    path('subscribe/', views.SubscriberCreateView.as_view(), name='subscribe'),
    path('temporary_webhook_endpoint/', views.WebhookResponseHandlerView.as_view(), name='webhook_endpoint') #TODO: get url from .env
]
