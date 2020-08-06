import threading
import mailchimp_marketing as MailchimpMarketing
from django.conf import settings
from mailchimp_marketing.api_client import ApiClientError
from .models import Subscriber
"""
For some tutorials on using mailchimp and django together, see:
https://djangopy.org/package-of-week/how-to-integrate-mailchimp-on-django-to-increase-subscribers/


See also:
https://mailchimp.com/developer/guides/create-your-first-audience
"""

class Mailchimp(object):
    """
    Abstracts common mailchimp tasks for newsletter use 
    """

    def __init__(self):
        """
        Constructor sets attributes 
        """
        self.mailchimp_client = MailchimpMarketing.Client()
        self.mailchimp_client.set_config({
            "api_key": settings.MAILCHIMP_API_KEY,
            "server": settings.MAILCHIMP_SERVER_PREFIX,
        })

        self.body = {
            "permission_reminder": "You signed up for updates on our website",
            "email_type_option": False,
            "campaign_defaults": {
                "from_name": "ubyssey",
                "from_email": "ubyssey@ubyssey.ca",
                "subject": "Ubyssey Newsletter",
                "language": "EN_US"
            },
            "name": "Ubyssey",
                "contact": {
                "company": "Ubysssey",
                "address1": "6133 University Blvd",
                "address2": "Suite 2209",
                "city": "Richmond",
                "state": "BC",
                "zip": "V6T 1Z1",
                "country": "CA"
            }
        }

    def create_list(self):
        """
        Expected to fail because at the moment we lack paid access to the mailchimp API
        """
        try:
            response = self.mailchimp_client.lists.create_list(self.body)
            print("Response: {}".format(response))
        except ApiClientError as error:
            print("An exception occurred: {}".format(error.text))

    def add_subscriber_to_list(self, subscriber, list_id=settings.MAILCHIMP_SUBSCRIBE_LIST_ID):
        try:
            member_info = {
                "email": subscriber.email, 
                "status": "pending",
                "merge_fields": {
                }
            }
            try:
                response = self.mailchimp_client.lists.add_list_member(list_id, member_info)
                print("response: {}".format(response))
            except ApiClientError as error:
                print("An exception occurred: {}".format(error.text))
        except AttributeError as error:
            print("An exception occurred: {}".format(error.text))