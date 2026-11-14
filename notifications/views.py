from django.contrib.auth.decorators import login_required

from django.http import JsonResponse
from django.utils import timezone

import datetime as dt
from collections import defaultdict

from notifications.stove_notifcations import AuthorDigest, EditorDigest, Deadline
from notifications.stove_notifcations import send_stove_notification_full, send_stove_notification_grouped

from article.models import ArticleAuthorsOrderable, ArticleDeadline

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
        #article_page__deadline_list__description="Draft in", # not really sure if this is how I should be filtering the deadlines, but this is what is set when an article with a deadline is created 
        article_page__deadline_list__completed=False,
        author_role="author"
    ).distinct()

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
        #article_page__deadline_list__description="Draft in", # not really sure if this is how I should be filtering the deadlines, but this is what is set when an article with a deadline is created 
        article_page__deadline_list__completed=False,
        author_role__in=['photo_editor', 'graphics_editor', 'backfield_editor'] # not sending for copy editor, becuase they get their own daily digest
    ).distinct()

    editor_expiring_articles = defaultdict(list)

    for editor_article in expiring_editor_articles:
        editor_expiring_articles[editor_article.author.full_name].append(editor_article.article_page.title)

    for editor in editor_expiring_articles.keys():
        notification = EditorDigest(editor_expiring_articles[editor])
        send_stove_notification_full(editor, notification)

# deadline_type refers to the description field of the ArticleDeadline
# will select articles where min_deadline_in_hours < deadline <= max_deadline_in_hours
def deadline_notification(deadline_type: str, max_deadline_in_hours: int, min_deadline_in_hours: int = 0):
    
    max_expiring_articles_date = get_date_hours_in_future(max_deadline_in_hours)
    min_expiring_articles_date = get_date_hours_in_future(min_deadline_in_hours)

    expiring_articles = ArticleDeadline.objects.select_related(
        "article_page"
    ).prefetch_related(
        "article_page__article_authors__author"
    ).filter(
        date__lte=max_expiring_articles_date,
        date__gt=min_expiring_articles_date,
        description=deadline_type,
        completed=False
    )

    for deadline in expiring_articles:
        authors = deadline.article_page.article_authors.all()
        authors_full_name = [author.author.full_name for author in authors]
        article_headline = deadline.article_page.title
        time_diff = (deadline.date - timezone.now()).total_seconds() // 3600
        notification = Deadline(article_headline, deadline_type, time_diff)
        send_stove_notification_grouped(authors_full_name, notification)

CRON_OFFSET = 0.5 #interval at which the deadline cron job fires in hours

def send_deadline_notifications():

    # Important: We send two notification timelines: One for deadline in 2hr, another for deadline in 24hr (special case for editing)
    # We avoid sending duplicate notifcations for deadlines < 2hr (1 for 2hr and 1 for 24hr)

    # TODO cache some of this stuff because we do pretty heavy repeated db access here

    topics = ArticleDeadline.objects.values_list("description", flat=True).distinct()

    for topic in topics:
        if (topic == "Editing"):
            deadline_notification("Editing", 24 + CRON_OFFSET, 24)
            deadline_notification("Editing", 2 + CRON_OFFSET, 2)
        else:
            deadline_notification(topic, 24 + CRON_OFFSET, 24)
            deadline_notification(topic, 2 + CRON_OFFSET, 2)

def send_deadline_naggers():

    topics = ArticleDeadline.objects.values_list("description", flat=True).distinct()

    for topic in topics:
        deadline_notification(topic, 0, -96) # going to cap at 4 days overdue, after 4 days nagging notifications will no longer be sent

def get_date_hours_in_future(hours: int):
    now = timezone.now()
    hours_elapsed = dt.timedelta(hours = hours)
    return now + hours_elapsed


