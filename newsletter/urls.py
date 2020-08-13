# newsletter/urls.py

from django.urls import path
from django.conf import settings
from . import views

app_name = 'newsletter'
urlpatterns = [
    path('subscribe/', views.SubscriberCreateView.as_view(), name='subscribe'),
    path(settings.MAILCHIMP_WEBHOOK_ENDPOINT_URL, views.WebhookResponseHandlerView.as_view(), name='webhook')
]
