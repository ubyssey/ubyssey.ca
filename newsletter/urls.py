# newsletter/urls.py

from django.urls import path
from django.conf import settings
from . import views

app_name = 'newsletter'
urlpatterns = [
    path(settings.MAILCHIMP_WEBHOOK_ENDPOINT_URL, views.WebhookResponseHandlerView.as_view(), name='webhook')
]
