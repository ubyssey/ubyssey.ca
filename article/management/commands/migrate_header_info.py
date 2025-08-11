from django.core.management.base import BaseCommand

import asyncio
from asgiref.sync import async_to_sync, sync_to_async

from article.models import StandardArticlePage

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    async def migrate_article(self, article):
        header_type = "standard_header"

        value = {
                "title": (article.fw_alternate_title if article.fw_alternate_title!=None else ""),
                "layout": article.header_layout,
                "subtitle": (article.subtitle if article.subtitle!=None else ""),
                "above_cut_lede": (f"<p>{article.above_cut_lede}</p>" if (article.above_cut_lede!=None and article.above_cut_lede!="") else ""),
            }

        if await article.featured_media.all().acount() > 0: 
            video_url = (await article.featured_media.all().afirst()).video
            if video_url != None:
                header_type = "standard_header_with_youtube_video"
                value["youtube_url"] = video_url

        article.header = [{
            "type": header_type,
            "value": value
        }]

        await article.asave(update_fields=["header"])
        print(f'SAVED: {article.title}\n         - {await sync_to_async(article.get_url)()}')
        if article.first_published_at != None:
            specific = await sync_to_async(article.get_specific)()
            revision = await sync_to_async(specific.save_revision)()
            await sync_to_async(revision.publish)()

        print(f'PUBLISHED: {article.title}\n         - {await sync_to_async(article.get_url)()}')

    @async_to_sync
    async def handle(self, *args, **options):
        #article = await StandardArticlePage.objects.filter(slug="ways-to-avoid-ams").afirst()
        #await self.migrate_article(article)        
        tasks = []
        async for article in StandardArticlePage.objects.live().filter(header__isnull=True).order_by("-first_published_at"):
            tasks.append(asyncio.create_task(self.migrate_article(article)))
            if len(tasks) > 100:
                print("gather")
                await asyncio.gather(*tasks) 
                tasks = []                

        print("gather")
        await asyncio.gather(*tasks)