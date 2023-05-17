# import kronos
# import requests
#
# from django.conf import settings
# from django.urls import reverse
#
# # Setup cron jobs
#
# # Cron task for pushing notifications, if there are any, every minute
# @kronos.register('* * * * *')
# def send_notifications():
#     url = "%s%s" % (settings.BASE_URL.strip('/'), reverse('api-notifications-push'))
#     requests.post(url)
#
# # Cron task for counting subscribers daily at midnight
# @kronos.register('0 0 * * *')
# def count_subscribers():
#     url = "%s%s" % (settings.BASE_URL.strip('/'), reverse('api-subscriptioncount-list'))
#     requests.post(url)
