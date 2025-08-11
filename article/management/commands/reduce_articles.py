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
    help = 'Runs the get_image_urls method'

    #@async_to_sync
    def handle(self, *args, **options):
        print("Uncomment this manage command in 'article/management/commands/reduce_articles.py' to delete old articles to create a reduced test database")
        
        # Dump this database to a .sql file by running 'msqldump' in the mysql docker container
        # Use 'docker cp' to move the file out of the docker container 
        
        '''
        cutoff = timezone.now() - timezone.timedelta(days=300)
        division = timezone.timedelta(days=30)
        
        time = cutoff
        while ArticlePage.objects.filter(first_published_at__lte=cutoff).exists():
            articleGroup = ArticlePage.objects.filter(first_published_at__lte=time, first_published_at__gte=time-division)
            print(f' - deleted {articleGroup.count()}\n          - {time-division}\n          - {time}')
            articleGroup.delete()
            time = time - division

        authors_without_articles = AuthorPage.objects.annotate(article_count=Count('article_authors')).filter(article_count=0)
        print(f"Authors with articles: {authors_without_articles.count()}")
        for author in authors_without_articles:
            print(f" - {author.full_name}")
            author.delete()

        topics_without_articles = ArticleTopic.objects.annotate(article_count=Count("tagged_articles")).filter(article_count=0)
        print(f"Topics without articles: {topics_without_articles.count()}")
        for topic in topics_without_articles:
            print(f" - {topic.name}")
            topic.delete()

        for image in UbysseyImage.objects.all():
            references = ReferenceIndex.get_references_to(image)
            if references.count() == 0:
                print(f" - {image.title}")
                image.delete()
        '''