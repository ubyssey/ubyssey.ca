from django.core.management.base import BaseCommand
from article.models import ArticlePage, ArticlePageTag, ArticleTopic, TaggedArticlePage
from taggit.models import Tag
from asgiref.sync import async_to_sync, sync_to_async
import asyncio

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    @sync_to_async
    def put_topic(self, tag, article):
        print("put")
        topic = ArticleTopic.objects.filter(slug=tag.slug).first()
        if topic == None:
            try:
                topic = ArticleTopic.objects.create(slug=tag.slug, name=tag.name)
                print(tag.name)
            except Exception as e:
                print(e)
                topic = ArticleTopic.objects.filter(slug=tag.slug).first()

        if topic.last_used_at == None:
            topic.last_used_at = article.first_published_at
        elif not article.first_published_at == None:
            if topic.last_used_at <= article.first_published_at:
                topic.last_used_at = article.first_published_at
                
        print(topic.name)

        topic.save()
        print("save")

        return topic

    @async_to_sync
    async def handle(self, *args, **options):

        async def handle_pair(pair):
            tag = await Tag.objects.aget(id=pair.tag_id)
            print(tag.name)
            article = await ArticlePage.objects.aget(page_ptr_id=pair.content_object_id)
            topic = await self.put_topic(tag, article)
            if not await TaggedArticlePage.objects.filter(tag=topic, content_object_id=pair.content_object_id).aexists():
                await TaggedArticlePage.objects.acreate(tag=topic, content_object_id=pair.content_object_id)

        TASK_MAX = 50
        tasks = []
        async for pair in ArticlePageTag.objects.all():
            tasks.append(asyncio.create_task(handle_pair(pair)))
            if len(tasks) > TASK_MAX:
                await asyncio.gather(*tasks)
                print("*** handling ***")
                tasks = []
        await asyncio.gather(*tasks)

        async def set_count(topic):
            topic.tagged_articles_count = await TaggedArticlePage.objects.filter(tag=topic).acount()
            print(topic.tagged_articles_count)
            await topic.asave()

        tasks = []
        async for topic in ArticleTopic.objects.all():
            tasks.append(asyncio.create_task(set_count(topic)))
            if len(tasks) > TASK_MAX:
                await asyncio.gather(*tasks)
                print("*** counting ***")
                tasks = []
        await asyncio.gather(*tasks)