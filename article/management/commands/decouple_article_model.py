from django.core.management.base import BaseCommand
from django.utils import timezone

from article.models import ArticlePage, StandardArticlePage
from asgiref.sync import async_to_sync, sync_to_async
import asyncio
from django.contrib.contenttypes.models import ContentType

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    @async_to_sync
    async def handle(self, *args, **options):
        TASK_MAX = 25
        ct = await sync_to_async(ContentType.objects.get_for_model)(StandardArticlePage)

        async def convert_article(article):
            #print(article.title)
            if not await StandardArticlePage.objects.filter(pk=article.pk).aexists():
                standard_article = await sync_to_async(StandardArticlePage)(pk=article.pk)
            else:
                standard_article = await StandardArticlePage.objects.aget(pk=article.pk)
            
            standard_article.content_sap = article.content                   
            standard_article.disclaimer_sap = article.disclaimer
            standard_article.legacy_template_sap = article.legacy_template            
            standard_article.legacy_template_data_sap = article.legacy_template_data
            standard_article.legacy_revision_number_sap = article.legacy_revision_number
            standard_article.layout_sap = article.layout
            standard_article.fw_alternate_title_sap = article.fw_alternate_title
            standard_article.subtitle_sap = article.subtitle
            standard_article.above_cut_lede = article.fw_above_cut_lede
            standard_article.header_layout_sap = article.header_layout
            standard_article.use_default_template_sap = article.use_default_template
            standard_article.db_template_sap_id = article.db_template_id
            article.content_type = ct

            await article.asave(update_fields=["content_type"])

            await sync_to_async(standard_article.save_base)(raw=True)

            specific = await sync_to_async(article.get_specific)()
            revision = await sync_to_async(specific.save_revision)()
            try:
                if article.first_published_at != None:
                    await sync_to_async(revision.publish)()
            except Exception as e:
                print("The error is: ",e)

        start = timezone.now()
        count = 0
        tasks = []
        articles = ArticlePage.objects.exclude(content_type=ct)
        total = await articles.acount()
        async for article in articles:
            tasks.append(asyncio.create_task(convert_article(article)))
            if len(tasks) >= TASK_MAX:
                count = count + len(tasks)
                estimate = start + (((timezone.now() - start)/count) * (total-count))
                print(f"{count}/{total}: ESTIMATED END {estimate}")
                await asyncio.gather(*tasks)
                tasks = []
        await asyncio.gather(*tasks)