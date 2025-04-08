from django.core.management.base import BaseCommand
from django.test import RequestFactory
from ubyssey.views.automate_adding_tags import get_image_urls

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        print("Hello World")
        # Create a dummy request object
        request = RequestFactory().get('/image-url/')
        request.META['SERVER_NAME'] = 'ubyssey.storage.googleapis.com'
        request.META['HTTP_HOST'] = 'ubyssey.storage.googleapis.com'
        get_image_urls(request)
