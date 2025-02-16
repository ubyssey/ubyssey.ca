from django.core.management.base import BaseCommand
from section.models import CategorySnippet, SectionPage, CategoryPage
from article.models import ArticlePage

class Command(BaseCommand): 
    help = 'Migrates the categories snippet model to section page'

    def handle(self, *args, **kwargs): 
        for c in CategorySnippet.objects.all():
            print(c.title)
            new_category = CategoryPage(
                title=c.title, 
                slug=c.slug,
                description = c.description,
                banner = c.banner)
            new_category = c.section_page.add_child(instance=new_category)
            for a in ArticlePage.objects.filter(category=c):
                print("- " + a.title)
                a.category_page = new_category
                a.save()