from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

import asyncio
from asgiref.sync import async_to_sync, sync_to_async

from publishing_analytics.views import get_month_overview

from django.utils import timezone

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        @async_to_sync
        async def info():
            tasks = []
            months = []
            for y in range(12):
                year = 2014 + y
                for m in range(12):
                    month = m + 1
                    tasks.append(asyncio.create_task(
                        sync_to_async(months.append)(await get_month_overview(year, month, reduce_to_length=True))
                    ))

            await asyncio.gather(*tasks)
            months = sorted(months, key=lambda month: month["yyyymm"])
            return months
        
        windows = info()
        output_file = 'months_overview.csv'
        with open(output_file, 'w') as f:
            f.write("Year, \
                    Academic year, \
                    Month, \
                    YYYY-MM,\
                    Article Count, \
                    Author count, \
                    New contributors, \
                    Articles per author, \
                    % of authors responsible for ~50%, \
                    % of authors responsible for ~25%\n")
            
            for window in windows:
                f.write(
                    f'{window["year"]}, \
                    {window["academic_year"]}, \
                    {window["month"]}, \
                    {window["yyyy-mm"]}, \
                    {window["articles"]}, \
                    {window["authors"]}, \
                    {window["new_contributors"]}, \
                    {window["article_per_author"]}, \
                    {window["top_fifty"]}, \
                    {window["top_twenty_five"]}\n'
                    )

        output_file = 'months_sections_overview.csv'
        with open(output_file, 'w') as f:
            f.write(
                "Year, \
                Academic year, \
                Month, \
                YYYY-MM,\
                Section, \
                Article Count, \
                Author count, \
                New contributors, \
                Articles per author, \
                % of authors responsible for ~50%, \
                % of authors responsible for ~25%\n"
                )
            
            for window in windows:
                for section in window["sections"]:
                    f.write(
                        f'{window["year"]}, \
                        {window["academic_year"]}, \
                        {window["month"]}, \
                        {window["yyyy-mm"]}, \
                        {section["title"]}, \
                        {section["articles"]}, \
                        {section["authors"]}, \
                        {section["new_contributors"]}, \
                        {section["article_per_author"]}, \
                        {section["top_fifty"]}, \
                        {section["top_twenty_five"]}\n'
                        )


            
