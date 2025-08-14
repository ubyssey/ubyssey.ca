from django.core.management.base import BaseCommand

from index.views import create_index

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        tree = create_index()

        def print_branch(root, spacing):
            print(f"{spacing} - {root['topic'].name}")
            for sub_topic in root['sub_topics']:
                print_branch(sub_topic, spacing + '   ')
            #print("")

        for root in tree:
            print_branch(root, '')
