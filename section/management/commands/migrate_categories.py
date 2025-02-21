from django.core.management.base import BaseCommand
from section.models import CategorySnippet, SectionPage, CategoryPage
from article.models import ArticlePage
from wagtail.models import Page
from wagtail.contrib.redirects.models import Redirect

class Command(BaseCommand): 
    help = 'Migrates the categories snippet model to section page'
    def handle(self, *args, **kwargs): 
        articles = ArticlePage.objects.live().exclude(category_page = None)
        print(" - %d categoried articles" % len(articles))
        for a in range(len(articles)):
            revision = articles[a].save_revision()
            if articles[a].first_published_at != None:
                revision.publish()
            if (a % 10 == 0):
                print(" - Transitioned %d articles" % a)
        print(" - Transitioned %d articles" % len(articles))
        
    '''
        for c in CategorySnippet.objects.all():
            print(c.title)
            new_path = c.section_page.url_path + c.slug + "/"
            if Page.objects.filter(url_path = new_path).exists():
                print(new_path + " already exists")
                if CategoryPage.objects.filter(url_path = new_path).exists():
                    new_category = CategoryPage.objects.get(url_path = new_path)
                else:
                    print(" - Existing is not a category page")
                    continue
            else:
                new_category = CategoryPage(
                    title=c.title, 
                    slug=c.slug,
                    description = c.description,
                    banner = c.banner)
                new_category = c.section_page.add_child(instance=new_category)
            
                old_path = "/" + c.section_page.slug + "/category/" + c.slug + "/"
                Redirect.add_redirect(old_path, redirect_to = new_category)
                Redirect.add_redirect(old_path+"rss/", redirect_to = new_category.url + "rss/")

            articles = ArticlePage.objects.filter(category=c).exclude(category_page = new_category)
            for a in articles:
                a.category_page = new_category
                a.save()
                revision = a.save_revision()
                if a.first_published_at != None:
                    revision.publish()
            print(" - Transitioned %d articles" % len(articles))
    '''