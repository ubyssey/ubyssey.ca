from dispatch.tests.cases import DispatchMediaTestMixin
from django.urls import reverse

from ubyssey.events.models import Event


class DispatchTestHelpers(object):
    @classmethod
    def create_event(
        cls,
        client,
        title="Test event",
        description="Test description",
        host="test host",
        image=None,
        start_time="2017-05-25T12:00",
        end_time="2017-05-25T12:01",
        location="test location",
        address="123 UBC",
        category="academic",
        facebook_url="https://www.facebook.com/events/280150289084959",
        facebook_image_url="some other similar fb url",
        is_submission=False,
        is_published=False,
        submitter_phone="+1 778 555 5555",
        submitter_email="developers@ubyssey.ca",
    ):
        obj = DispatchMediaTestMixin()

        with open(obj.get_input_file("test_image.jpg")) as test_image:
            data = {
                "title": title,
                "description": description,
                "host": host,
                "image": test_image,
                "start_time": start_time,
                "end_time": end_time,
                "location": location,
                "category": category,
                "facebook_url": facebook_url,
                "facebook_image_url": facebook_image_url,
                "is_submission": is_submission,
                "is_published": is_published,
                "submitter_phone": submitter_phone,
                "submitter_email": submitter_email,
            }

            url = reverse("api-event-list")

            return client.post(url, data, format="multipart")
