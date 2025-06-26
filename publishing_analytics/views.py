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

def collect_authors(articles, identify_new_authors=False, get_page=True):
    authors = []
    for article in articles:
        for author in article.article_authors.filter(author_role="author"):
            ids = list(filter(lambda added_author: added_author["id"]==author.author_id, authors))

            if len(ids) > 0:
                ids[0]["articles"].append(article)

            else:
                author_info = {
                    "id": author.author_id,
                    "articles": [article],
                }
                if get_page:
                    author_info["page"] = author.author

                if identify_new_authors:
                    first = get_first_article(author.author)
                    author_info["new_contributor"] = article==first
                
                authors.append(author_info)
                    
                
    authors = sorted(authors, key=lambda author: len(author["articles"]), reverse=True)
    
    return authors

def get_bernie_sanders_statistic(authors, articles, percent):
    if len(authors) == 0:
        return 0 
    top_sum = 0
    top_count = 0
    for author in authors:
        top_sum = top_sum + len(author["articles"])
        top_count = top_count + 1
        if top_sum >= len(articles) * percent:
            break
    
    return (top_count/len(authors))

async def retrieve_new_authors_from_sections(window):
    window["new_contributors"] = None
    for section in window["sections"]:
        if window["new_contributors"] == None:
            window["new_contributors"] = section["new_contributors"]
        else:
            window["new_contributors"] = window["new_contributors"] + section["new_contributors"]

def get_academic_year(year, month):
    if month >= 5:
        return f'{year}/{year + 1}'
    else:
        return f'{year-1}/{year}'

async def get_month_overview(year, month, reduce_to_length=False):

    yearStart = timezone.datetime(year=year, month=month, day=1)
    yearEnd = (yearStart+timezone.timedelta(days=40))
    yearEnd = yearEnd - timezone.timedelta(days=(yearEnd.day - 1))
    articles = ArticlePage.objects.live().filter(explicit_published_at__gte=yearStart, explicit_published_at__lt=yearEnd).order_by("explicit_published_at")

    #print(month)
    window = {
        "month": month,
        "year": year,
        "academic_year": get_academic_year(year, month),
        "title": yearStart.strftime("%B %Y"),
        "yyyymm": int(f'{year}{"%02d" % (month,)}'),
        "yyyy-mm": f'{year}-{"%02d" % (month,)}',
        "articles": articles,
    }

    await get_sections(window)
    await get_article_analytics(window, reduce_to_length=reduce_to_length, identify_new_authors=False)

    tasks = []
    for section in window["sections"]:
        tasks.append(asyncio.create_task(get_article_analytics(section, reduce_to_length=reduce_to_length, identify_new_authors=True)))
    await asyncio.gather(*tasks)

    await retrieve_new_authors_from_sections(window)

    window["articles"] = await articles.acount()
    window["link"] = f"/overview/{year}/{'%02d' % (month,)}/"

    return window


async def get_article_analytics(window, reduce_to_length=False, identify_new_authors=False):
    articles = window["articles"]
    authors = await sync_to_async(collect_authors)(articles, identify_new_authors)

    window["authors"] = authors
    window["article_per_author"] = 0
    if len(authors) > 0:
        window["article_per_author"] = len(articles) / len(authors)
    if identify_new_authors:
        window["new_contributors"] = list(filter(lambda author: author["new_contributor"], authors))
    window["top_fifty"] = get_bernie_sanders_statistic(authors, articles, 0.5)
    window["top_twenty_five"] = get_bernie_sanders_statistic(authors, articles, 0.25)

    window["top_fifty_str"] = round(window["top_fifty"] * 100, 2)
    window["top_twenty_five_str"] = round(window["top_twenty_five"] * 100, 2)

    if reduce_to_length:
        window["articles"] = len(window["articles"])
        window["authors"] = len(authors)

        if identify_new_authors:
            window["new_contributors"] = len(window["new_contributors"])
    
    return window

async def get_sections(window):
    articles = window["articles"]
    sections = []
    async for article in articles:
                
        section = list(filter(lambda added_section: added_section["title"]==article.current_section, sections))
        if len(section) > 0:
            section[0]["articles"].append(article)
        else:
            #print(f'got {window["title"]} {article.current_section}')
            sections.append({
                "title": article.current_section,
                "articles": [article],
            })
    
    window["sections"] = sorted(sections, key=lambda section: len(section["articles"]), reverse=True)
    return window["sections"]

async def get_year_overview(year, identify_new_authors=True):
    
    yearStart = timezone.datetime(year=year, month=5, day=1)
    yearEnd = timezone.datetime(year=year+1, month=5, day=1)
    articles = ArticlePage.objects.live().filter(explicit_published_at__gte=yearStart, explicit_published_at__lt=yearEnd).order_by("explicit_published_at")

    #print(f'got {year} articles')
    window = {
        "year": year,
        "title": f'{yearStart.strftime("%Y")}/{yearEnd.strftime("%Y")}',
        "articles": articles,
    }

    tasks = []
    tasks.append(asyncio.create_task(
        get_sections(window)
        ))
    tasks.append(asyncio.create_task(
        get_article_analytics(window, reduce_to_length=True, identify_new_authors=identify_new_authors)
        ))
    
    await asyncio.gather(*tasks)

    tasks = []
    for section in window["sections"]:
        tasks.append(asyncio.create_task(get_article_analytics(section, reduce_to_length=True, identify_new_authors=identify_new_authors)))
    await asyncio.gather(*tasks)

    if identify_new_authors:
        await retrieve_new_authors_from_sections(window)

    window["link"] = f"/overview/{year}/"

    return window



# Pages

def overview(request):
    @async_to_sync
    async def get_years():
        years = []
        async def get_year(year):
            years.append(await get_year_overview(year, identify_new_authors=False))
        tasks = []
        for i in range(7):
            tasks.append(asyncio.create_task(get_year(2014 + i)))
        await asyncio.gather(*tasks)
        #print('got years')
        years = sorted(years, key=lambda year: year["year"])
        return years

    context= {"title": "Overview", "windows": get_years()}
    #print("finished???")
    #print(context)
    return render(request, 'publishing_analytics/overview.html', context)

def year_overview(request, year):
    @async_to_sync
    async def get_months():
        months = []
        async def get_month(month):
            months.append(await get_month_overview(int(year), int(month), reduce_to_length=True))
        tasks = []
        for i in range(12):
            tasks.append(asyncio.create_task(get_month(1 + i)))
        await asyncio.gather(*tasks)
        #print('got years')
        months = sorted(months, key=lambda month: month["month"])
        return months

    context= {"title": str(year), "windows": get_months()}
    #print("finished???")
    return render(request, 'publishing_analytics/overview.html', context)

def month_overview(request, year, month):
    overview = async_to_sync(get_month_overview)(int(year), int(month))

    def date_format(year,month):
        return f"{year}/{'%02d' % (month,)}"

    if int(month) == 12:
        next = date_format(int(year)+1, 1)
        prev = date_format(int(year), int(month)-1)
    elif int(month) == 1:
        next = date_format(int(year), int(month)+1)
        prev = date_format(int(year)-1, 12)
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