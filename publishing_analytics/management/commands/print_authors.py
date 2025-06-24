from django.core.management.base import BaseCommand

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

from django.utils import timezone

class Command(BaseCommand):
    help = 'Runs the get_image_urls method'

    def handle(self, *args, **options):
        authors = AuthorPage.objects.all()

        output_file = 'article_info.csv'
        with open(output_file, 'w') as f:
            
            f.write(f"Name, URL, Article count, First section, Frequent section, First, Last, Lifespan\n")
            for author in authors:
                articles = ArticlePage.objects.live().filter(article_authors__author=author).order_by("explicit_published_at")
                
                if len(articles) > 0:
                
                    start = None
                    end = None
                    startStr = None
                    endStr = None

                    exp = articles.exclude(explicit_published_at=None)
                    fpa = articles.exclude(first_published_at=None)

                    sections = list(map(lambda article: article.current_section, articles))
                    sectionSet = set(sections)
                    mostFrequentSection = sorted(list(sectionSet), key=lambda section: sections.count(section), reverse=True)[0]

                    firstArticleSection = None

                    if len(exp) > 0:
                        start = exp.first().explicit_published_at
                        firstArticleSection = exp.first().current_section
                    elif len(fpa) > 0:
                        start = fpa.first().first_published_at
                        firstArticleSection = fpa.first().current_section

                    if start != None:
                        startStr = start.strftime("%Y-%m-%d")

                    if len(exp) > 0:
                        end = exp.last().explicit_published_at
                    elif len(fpa) > 0:
                        end = fpa.last().first_published_at
                        
                    if end != None:
                        endStr = end.strftime("%Y-%m-%d")

                    lifespan = None
                    if start != None and end != None:
                        lifespan = (end - start).days
                        print(f'- {lifespan} days')

                    name = author.full_name.replace(",", "")
                    
                    f.write(f"{name}, https://ubyssey.ca/authors/{author.slug}/, {len(articles)}, {firstArticleSection}, {mostFrequentSection}, {startStr}, {endStr}, {lifespan}\n")

                    print("")
