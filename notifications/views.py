from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from notifications.stove_notifcations import send_stove_notification_full, AuthorDigest

import datetime as dt
from collections import defaultdict

from article.models import ArticleAuthorsOrderable

@login_required
def mockWebPush(request):
    print("hit")
    daily_author_digest()
    return JsonResponse({"success": True})

# cron jobs

# sends notifications to all authors with stories expiring in 36 hours 
def daily_author_digest():

    print("hit daily author")

    expiring_articles_date = get_date_hours_in_future(36)

    expiring_author_articles = ArticleAuthorsOrderable.objects.select_related(
        "article_page",
        "author"
    ).filter(
        #article_page__deadline__gte=expiring_articles_date, don't know how to get this to work TODO
        author_role="author"
    )

    #map the author to their expiring articles, could do this as an aggregation in sql but I think it would be add unnessecary complexity
    author_expiring_articles = defaultdict(list)

    for author_article in expiring_author_articles:
        author_expiring_articles[author_article.author.full_name].append(author_article.article_page.title)
        print(f"{author_article.article_page.title}: {author_article.author.full_name}")

    for author in author_expiring_articles.keys():
        notification = AuthorDigest(author_expiring_articles[author])
        send_stove_notification_full(author, notification)
        

def get_date_hours_in_future(hours: int):
    now = dt.datetime.now()
    hours_elapsed = dt.timedelta(hours = hours)
    return now + hours_elapsed