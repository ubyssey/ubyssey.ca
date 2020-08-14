# newsletter/urls.py

from django.urls import path, re_path
from django.conf import settings
from . import views

app_name = 'newsletter'
urlpatterns = [
    re_path(r'^$', views.mailchimp_landing_redirect, name='newsletter'),
    # path(settings.MAILCHIMP_WEBHOOK_ENDPOINT_URL, views.WebhookResponseHandlerView.as_view(), name='webhook')
]
