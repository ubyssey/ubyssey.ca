from django.core.management.base import BaseCommand
from django.utils import timezone

from wagtail.models import PageLogEntry 

from article.models import ArticlePage, StandardArticlePage
from asgiref.sync import async_to_sync, sync_to_async
import asyncio
from django.contrib.contenttypes.models import ContentType

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    @async_to_sync
    async def handle(self, *args, **options):
        live_articles = ArticlePage.objects.filter(live=True)
        live_articles_count = await live_articles.acount()
        start = timezone.now()

        i = 0
        async for article in live_articles:
            logs = PageLogEntry.objects.filter(page_id=article.id).order_by("-timestamp")
            first_action = (await logs.afirst()).action

            if first_action == "wagtail.publish":
                pub_count = 0
                unpub_count = 0
                async for log in logs:
                    if log.action == "wagtail.publish":
                        pub_count = pub_count + 1
                    elif log.action == "wagtail.unpublish":
                        unpub_count = unpub_count + 1

                    if pub_count == 2:
                        break

                    if unpub_count>=1:
                        if article.live:
                            await sync_to_async(article.unpublish)()
                            print(f"UNPUBLISHED {pub_count} {unpub_count}\n        - {article.title}\n        - https://ubyssey.ca/admin/pages/{article.id}/edit")
                        else:
                            print(f"correctly not published\n        - {article.title}\n        - https://ubyssey.ca/admin/pages/{article.id}/edit")


            #else:
            #    #print(f"{article.title}\n       {first_action} https://ubyssey.ca/admin/pages/{article.id}/edit")
                
            i = i + 1

            if i % 50 == 0:
                now = timezone.now()
                estimate = now + (((now - start)/i)*(live_articles_count - i) )
                #print(f"{i}/{live_articles_count} Estimate end: {estimate}")