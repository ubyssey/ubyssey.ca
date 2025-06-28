from django.core.management.base import BaseCommand
from article.models import ArticlePage, StandardArticlePage
from asgiref.sync import async_to_sync, sync_to_async
import asyncio
from django.contrib.contenttypes.models import ContentType

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    @async_to_sync
    async def handle(self, *args, **options):
        TASK_MAX = 50
        ct = await sync_to_async(ContentType.objects.get_for_model)(StandardArticlePage)

        async def convert_article(article):
            #print(article.title)
            if not await StandardArticlePage.objects.filter(pk=article.pk).aexists():
                standard_article = await sync_to_async(StandardArticlePage)(pk=article.pk)
            else:
                standard_article = await StandardArticlePage.objects.aget(pk=article.pk)
            
            standard_article.content_sap = article.content                   
            standard_article.explicit_published_at_sap = article.explicit_published_at
            standard_article.show_last_modified_sap = article.show_last_modified            
            standard_article.storystream_view_sap = article.storystream_view
            standard_article.filter_by_tags_sap = article.filter_by_tags
            standard_article.disclaimer_sap = article.disclaimer
            standard_article.legacy_template_sap = article.legacy_template            
            standard_article.legacy_template_data_sap = article.legacy_template_data
            standard_article.legacy_revision_number_sap = article.legacy_revision_number
            standard_article.layout_sap = article.layout
            standard_article.fw_alternate_title_sap = article.fw_alternate_title
            standard_article.subtitle_sap = article.subtitle
            standard_article.stand_first = article.title_tag
            standard_article.above_cut_lede = article.fw_above_cut_lede
            standard_article.header_layout_sap = article.header_layout
            standard_article.use_default_template_sap = article.use_default_template
            standard_article.db_template_sap = article.db_template
            article.content_type = ct

            await article.asave(update_fields=["content_type"])

            await sync_to_async(standard_article.save_base)(raw=True)

            try:
                revision = await sync_to_async(standard_article.save_revision)()
                if standard_article.first_published_at != None:
                    await sync_to_async(revision.publish)()
            except:
                print(article)
                print(f'{article.current_section}/{article.slug}/')

        tasks = []
        async for article in ArticlePage.objects.all():
            tasks.append(asyncio.create_task(convert_article(article)))
            if len(tasks) >= TASK_MAX:
                print("sheesh")
                await asyncio.gather(*tasks)                
                tasks = []
        await asyncio.gather(*tasks)