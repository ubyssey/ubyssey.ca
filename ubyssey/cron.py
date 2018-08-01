import kronos
import json
import requests

from pywebpush import webpush, WebPushException

from django.conf import settings
from django.utils import timezone
from django.core.urlresolvers import reverse
from dispatch.models import Article, Notification, Subscription

# Cron job helper functions

def push_notifications(article):
    # grab each endpoint from list in database and make a push
    data={
        'headline': article.headline,
        'url': article.get_absolute_url(),
        'snippet': article.snippet,
        }
    if article.featured_image is not None:
        data['image'] = article.featured_image.image.get_thumbnail_url()

    subscriptions = Subscription.objects.all()
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }},
                data=json.dumps(data),
                vapid_private_key=settings.NOTIFICATION_KEY,
                vapid_claims={
                        "sub": "mailto:YourNameHere@example.org===",
                    }
            )
        except WebPushException as ex:
            if ex.response.status_code == 410:
                sub.delete()

# Setup cron jobs

# 8:30 am
@kronos.register('* * * * *')
def send_notifications():
    notification = Notification.objects \
        .filter(scheduled_push_time__lte=timezone.now()) \
        .order_by('scheduled_push_time') \
        .first()

    if notification is not None:
        article = Article.objects.filter(parent__id=notification.article.parent_id, is_published=True).first()
        if article is not None:
            push_notifications(article)
            notification.delete()

    return

@kronos.register('0 0 * * *')
def count_subscribers():
    url = "%s%s" % (settings.BASE_URL.strip('/'), reverse('api-subscriptioncount-list'))
    requests.post(url)
