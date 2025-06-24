from django.shortcuts import render
from django.utils import timezone
from django.http import HttpResponse

import asyncio
from asgiref.sync import async_to_sync, sync_to_async

from authors.models import AuthorPage
from article.models import ArticleAuthorsOrderable, ArticlePage

# Create your views here.
def author_publish_frequency(request):
    authors = AuthorPage.objects.all()

    for author in authors:
        print(author.full_name)
        articles = ArticlePage.objects.filter(authors=author).order_by("article_page__explicit_published_at")

        lifespan = articles.last.explicit_published_at - articles.first.explicit_published_at
        print(f'- {len(articles)} articles')
        print(f'- {lifespan}')
        print('\n')

def get_first_article(authorPage):
    return ArticleAuthorsOrderable.objects.filter(author=authorPage, author_role="author", article_page__live=True).order_by('article_page__explicit_published_at').first().article_page

def collect_authors(articles):
    authors = []
    for article in articles:
        for author in article.article_authors.filter(author_role="author"):
            page = list(filter(lambda added_author: added_author["page"]==author.author, authors))

            if len(page) > 0:
                page[0]["articles"].append(article)

            else:
                
                first = get_first_article(author.author)
                
                authors.append({
                    "page": author.author,
                    "articles": [article],
                    "new_contributor": article==first,
                    })
                    
                
    authors = sorted(authors, key=lambda author: len(author["articles"]), reverse=True)
    
    return authors

def get_bernie_sanders_statistic(authors, articles):
    top_sum = 0
    top_count = 0
    for author in authors:
        top_sum = top_sum + len(author["articles"])
        top_count = top_count + 1
        if top_sum * 2 >= len(articles):
            break
    
    return round((top_count/len(authors)) * 100, 2)

def get_month_overview(year, month):

    yearStart = timezone.datetime(year=year, month=month, day=1)
    yearEnd = (yearStart+timezone.timedelta(days=40))
    yearEnd = yearEnd - timezone.timedelta(days=(yearEnd.day - 1))
    articles = ArticlePage.objects.live().filter(explicit_published_at__gte=yearStart, explicit_published_at__lt=yearEnd).order_by("explicit_published_at")

    window = {
        "title": yearStart.strftime("%B %Y"),
        "articles": articles,
    }

    authors = collect_authors(articles)
    window["authors"] = authors
    window["new_contributors"] = list(filter(lambda author: author["new_contributor"], window["authors"]))

    sections = []
    for article in window["articles"]:
                
        section = list(filter(lambda added_section: added_section["title"]==article.current_section, sections))
        if len(section) > 0:
            section[0]["articles"].append(article)
        else:
            sections.append({
                "title": article.current_section,
                "articles": [article],
            })

    for section in sections:
        section["authors"] = collect_authors(section["articles"])

    window["sections"] = sorted(sections, key=lambda section: len(section["articles"]), reverse=True)

    window["top"] = get_bernie_sanders_statistic(authors, articles)

    return window



async def get_year_overview(year):
    
    yearStart = timezone.datetime(year=year, month=5, day=1)
    yearEnd = timezone.datetime(year=year+1, month=5, day=1)
    articles = ArticlePage.objects.live().filter(explicit_published_at__gte=yearStart, explicit_published_at__lt=yearEnd).order_by("explicit_published_at")

    window = {
        "year": year,
        "title": f'{yearStart.strftime("%Y")}/{yearEnd.strftime("%Y")}',
        "articles": await articles.acount(),
    }

    sections = []
    async for article in articles:
                
        section = list(filter(lambda added_section: added_section["title"]==article.current_section, sections))
        if len(section) > 0:
            section[0]["articles"].append(article)
        else:
            sections.append({
                "title": article.current_section,
                "articles": [article],
            })

    for section in sections:
        section["articles"] = len(section["articles"])

    window["sections"] = sorted(sections, key=lambda section: section["articles"], reverse=True)

    authors = await sync_to_async(collect_authors)(articles)
    window["authors"] = len(authors)
    window["new_contributors"] = len(list(filter(lambda author: author["new_contributor"], authors)))

    top_sum = 0
    top_count = 0
    for author in authors:
        top_sum = top_sum + len(author["articles"])
        top_count = top_count + 1
        if top_sum * 2 >= len(articles):
            break
    
    window["top"] = get_bernie_sanders_statistic(authors, articles)
    
    return window

def overview(request):
    @async_to_sync
    async def get_years():
        years = []
        async def get_year(year):
            years.append(await get_year_overview(year))
        tasks = []
        for i in range(12):
            tasks.append(asyncio.create_task(get_year(2014 + i)))
        await asyncio.gather(*tasks)
        years = sorted(years, key=lambda year: year["year"])
        return years

    context= {"years": get_years()}
    return render(request, 'publishing_analytics/overview.html', context)

def month_overview(request, year, month):
    overview = get_month_overview(int(year), int(month))

    def date_format(year,month):
        return f"{year}/{'%02d' % (month,)}"

    if int(month) == 12:
        next = date_format(int(year)+1, 1)
        prev = date_format(int(year), int(month)-1)
    elif month == 1:
        next = date_format(int(year), int(month)+1)
        prev = date_format(int(year-1), 12)
    else:
        next = date_format(int(year), int(month)+1)
        prev = date_format(int(year), int(month)-1)

    context = {
        "year": year,
        "month": overview,

        "next": next,
        "prev": prev,
        }
    return render(request, 'publishing_analytics/month_overview.html', context)