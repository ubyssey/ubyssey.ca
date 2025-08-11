from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

import asyncio
from asgiref.sync import async_to_sync, sync_to_async

from publishing_analytics.views import get_month_overview, get_year_overview

from django.utils import timezone

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        @async_to_sync
        async def info():
            years = []
            async def get_year(year):
                years.append(await get_year_overview(year, identify_new_authors=False))
            tasks = []
            for i in range(12):
                tasks.append(asyncio.create_task(get_year(2014 + i)))
            await asyncio.gather(*tasks)
            years = sorted(years, key=lambda year: year["year"])
            return years

        windows = info()
        output_file = 'years_overview.csv'
        with open(output_file, 'w') as f:
            f.write("Year, Academic year, Article Count, Author count, New contributors, Articles per author, % of authors responsible for ~50%, % of authors responsible for ~25%\n")
            
            for window in windows:
                f.write(f'{window["year"]}, {window["title"]}, {window["articles"]}, {window["authors"]}, {window["new_contributors"]}, {window["article_per_author"]}, {window["top_fifty"]}, {window["top_twenty_five"]}\n')

        output_file = 'sections_overview.csv'
        with open(output_file, 'w') as f:
            f.write("Year, Academic year, Section, Article Count, Author count, New contributors, Articles per author, % of authors responsible for ~50%, % of authors responsible for ~25%\n")
            for window in windows:
                for section in window["sections"]:
                    f.write(f'{window["year"]}, {window["title"]}, {section["title"]}, {section["articles"]}, {section["authors"]}, {section["new_contributors"]}, {section["article_per_author"]}, {section["top_fifty"]}, {section["top_twenty_five"]}\n')


            
