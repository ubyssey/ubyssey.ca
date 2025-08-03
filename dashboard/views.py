from django.shortcuts import render

from wagtail.models import Workflow, TaskState, Task

from home.models import HomePage
from dashboard.models import PublishingCommitteeApprovalTaskState

# Create your views here.

def publishing_schedule_dashboard(request):

    live = HomePage.objects.all().first()
    live_articles = [live.cover_story.specific] + [a.article for a in live.top_articles.all()] 

    scheduled = live.get_latest_revision_as_object()
    scheduled_articles = [scheduled.cover_story.specific.get_latest_revision_as_object()] + [a.article.get_latest_revision_as_object() for a in scheduled.top_articles.all()]

    live_revision_id = live.live_revision.id
    scheduled_revision_id = live.latest_revision.id

    task_states = PublishingCommitteeApprovalTaskState.objects.filter(status=TaskState.STATUS_IN_PROGRESS).order_by("-started_at")

    return render(request, "wagtailadmin/publishing-schedule/index.html", {
        'live': live,
        'live_revision_id': live_revision_id,
        'live_articles': live_articles,

        'scheduled': scheduled,
        'scheduled_revision_id': scheduled_revision_id,
        'scheduled_articles':scheduled_articles,

        'task_states': task_states
        })