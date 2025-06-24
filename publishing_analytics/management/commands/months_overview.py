from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

from views import get_month_overview

from django.utils import timezone

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        windows = get_month_overview()

        output_file = 'month_overview.csv'
        with open(output_file, 'w') as f:
            for window in windows:
                print(window["title"])
                f.write(f'{window["title"]}\n')
                for author in window["authors"]:
                    print(f' - {author["page"].full_name}')
                    f.write(f' - {author["page"].full_name}\n')

                    for article in author["articles"]:
                        print(f'   - {article.title} https://ubyssey.ca/{article.current_section}/{article.slug}/')
                        f.write(f'   - {article.title} https://ubyssey.ca/{article.current_section}/{article.slug}/\n')

                f.write(f'\n')
                print("")


            
