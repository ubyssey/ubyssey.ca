from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Count

from wagtail.models.reference_index import ReferenceIndex

from images.models import UbysseyImage
from authors.models import AuthorPage
from article.models import ArticlePage, ArticleTopic
from asgiref.sync import async_to_sync, sync_to_async
import asyncio

class Command(BaseCommand):
    help = 'Updates count, last used, and relevance score for all topics'

    @async_to_sync
    async def handle(self, *args, **options):
        topics = await sync_to_async(list)(ArticleTopic.objects.all())
        tasks = [topic.update_topic() for topic in topics]
        await asyncio.gather(*tasks)