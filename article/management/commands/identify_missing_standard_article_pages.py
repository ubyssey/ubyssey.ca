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
        articles = ArticlePage.objects.all()
        articles_count = await articles.acount()
        missing_count = 0

        start = timezone.now()

        i = 0
        async for article in articles:
            try:
                s = await sync_to_async(article.get_specific)()
            except Exception as e:
                missing_count = missing_count + 1
                print(f"{missing_count} MISSING\n        - {article.title}\n        - http://localhost:8000/admin/pages/{article.id}/edit")
                print(e)

                standard_article = await sync_to_async(StandardArticlePage)(pk=article.pk)
                await sync_to_async(standard_article.save_base)(raw=True)

                if article.live and article.first_published_at != None:

                    logs = PageLogEntry.objects.filter(page_id=article.id).order_by("-timestamp")

                    pubed = 0
                    async for log in logs:
                        if log.action == "wagtail.publish":
                            pubed = 1
                        elif log.action == "wagtail.unpublish":
                            break
                        elif pubed == 1 and log.action == "wagtail.edit":                            
                            def publish_revision(log):
                                log.revision.publish()
                            await sync_to_async(publish_revision)(log)

                            print("        - published")
                            break

            i = i + 1

            if i % 50 == 0:
                now = timezone.now()
                estimate = now + (((now - start)/i)*(articles_count - i) )
                #print(f"{i}/{live_articles_count} Estimate end: {estimate}")
        
        print(f"\n{missing_count}/{articles_count} missing")