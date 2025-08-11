from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

from publishing_analytics.views import get_year_overview, get_all_years

from django.utils import timezone

import asyncio
from asgiref.sync import async_to_sync, sync_to_async

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):

        @async_to_sync
        async def get_years():
            years = []
            async def get_year(year):
                years.append(await get_year_overview(year, reduce_to_length=False, identify_new_authors=True))
            tasks = []
            for year in await sync_to_async(get_all_years)():
                tasks.append(asyncio.create_task(get_year(year)))
            await asyncio.gather(*tasks)
            
            years = sorted(years, key=lambda year: year["year"])
            return years
        
        output_file = 'authors_by_academic_year_by_section.csv'
        with open(output_file, 'w') as f:
            
            f.write(f"Academic year, Section, Author, Author URL, Article count, First contribution?\n")
            for year in get_years():
                for section in year["sections"]:
                    for author in section["authors"]:
                        f.write(f'{year["title"]}, {section["title"]}, {author["page"].full_name.replace(",", "")}, https://ubyssey.ca/authors/{author["page"].slug}/, {len(author["articles"])}, {author["new_contributor"]}\n')
