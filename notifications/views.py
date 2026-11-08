from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from notifications.stove_notifcations import send_stove_notification_full, AuthorDigest, EditorDigest

import datetime as dt
from django.utils import timezone
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

    expiring_articles_date = get_date_hours_in_future(36)

    expiring_author_articles = ArticleAuthorsOrderable.objects.select_related(
        "article_page",
        "author",
    ).filter(
        article_page__deadline_list__date__lte=expiring_articles_date,
        article_page__deadline_list__date__gte=timezone.now(),
        article_page__deadline_list__description="Draft in", # not really sure if this is how I should be filtering the deadlines, but this is what is set when an article with a deadline is created 
        article_page__deadline_list__completed=False,
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

def daily_editor_digest():

    expiring_articles_date = get_date_hours_in_future(36)

    expiring_editor_articles = ArticleAuthorsOrderable.objects.select_related(
        "article_page",
        "author"
    ).filter(
        article_page__deadline_list__date__lte=expiring_articles_date,
        article_page__deadline_list__date__gte=timezone.now(),
        article_page__deadline_list__description="Draft in", # not really sure if this is how I should be filtering the deadlines, but this is what is set when an article with a deadline is created 
        article_page__deadline_list__completed=False,
        author_role__in=['photo_editor', 'graphics_editor', 'backfield_editor'] # not sending for copy editor, becuase they get their own daily digest
    )

    editor_expiring_articles = defaultdict(list)

    for editor_article in expiring_editor_articles:
        editor_expiring_articles[editor_article.author.full_name].append(editor_article.article_page.title)

    for editor in editor_expiring_articles.keys():
        notification = EditorDigest(editor_expiring_articles[editor])
        send_stove_notification_full(editor, notification)

def get_date_hours_in_future(hours: int):
    now = timezone.now()
    hours_elapsed = dt.timedelta(hours = hours)
    return now + hours_elapsed


