from datetime import datetime, timezone
from django.core.management.base import BaseCommand, CommandError
from dispatch.models import Article


class Command(BaseCommand):

    def handle(self, *args, **options):
        desktop_ad = {"type":"ad","data":"desktop"}
        mobile_ad = {"type":"ad","data":"mobile"}

        article_qs = Article.objects.filter(is_published=True).order_by('-published_at') 
        for article in article_qs:
            if desktop_ad in article.content or mobile_ad in article.content:
                while desktop_ad in article.content:
                    try:
                        article.content.remove(desktop_ad)
                    except ValueError:
                        self.stdout.write(self.style.ERROR('Error with article: %s, %s' % (str(article.published_at), article.slug)))
                        break            
                while mobile_ad in article.content:
                    try:
                        article.content.remove(mobile_ad)
                    except ValueError:
                        self.stdout.write(self.style.ERROR('Error with article: %s, %s' % (str(article.published_at), article.slug)))
                        break
                article.save(revision=False)
            if not (desktop_ad in article.content or mobile_ad in article.content):
                self.stdout.write(self.style.SUCCESS('Successfully cleaned: %s, %s' % (str(article.published_at), article.slug)))
