from django.core.management.base import BaseCommand, CommandError

import requests

from django.conf import settings
from django.core.urlresolvers import reverse

# Setup cron jobs

class Command(BaseCommand):
    help = 'Sends notifications to all subscribers'

    def handle(self, *args, **options):
        url = "%s%s" % (settings.BASE_URL.strip('/'), reverse('api-notifications-push'))
        requests.post(url)
        self.stdout.write("Notifications sent")