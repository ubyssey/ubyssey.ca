from django.core.management.base import BaseCommand

from asgiref.sync import async_to_sync, sync_to_async

from article.models import ArticlePage

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    @async_to_sync
    async def handle(self, *args, **options):

        articles = ArticlePage.objects.live()

        async for article in articles:
            if article.current_section == "features" or article.current_section == "opinion":
                article.timeliness = ArticlePage.TimelinessChoices.YEAR
            if article.current_section == "science":
                if "covid" in article.title.lower():
                    article.timeliness = ArticlePage.TimelinessChoices.MONTH
                else:
                    article.timeliness = ArticlePage.TimelinessChoices.YEAR
            else:
                article.timeliness = ArticlePage.TimelinessChoices.WEEK

            specific = await sync_to_async(article.get_specific)()
            revision = await sync_to_async(specific.save_revision)()
            await sync_to_async(revision.publish)()

            print(f" - {article.timeliness} - ({article.current_section}) {article.title}")
            