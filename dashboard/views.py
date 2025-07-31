from django.shortcuts import render

from wagtail.models import Workflow

from home.models import HomePage

# Create your views here.

def publishing_schedule_dashboard(request):

    live = HomePage.objects.all().first()
    live_articles = [live.cover_story] + [a.article for a in live.top_articles.all()] 

    scheduled = live.get_latest_revision_as_object()
    scheduled_articles = [scheduled.cover_story] + [a.article for a in scheduled.top_articles.all()]

    live_revision_id = live.live_revision.id
    scheduled_revision_id = live.latest_revision.id

    workflow_states = []
    workflow = Workflow.objects.filter(name="Publishing committee").first()
    if workflow != None:
        workflow_states = workflow.workflow_states.filter(status="in_progress")

    return render(request, "wagtailadmin/publishing-schedule/index.html", {
        'live': live,
        'live_revision_id': live_revision_id,
        'live_articles': live_articles,

        'scheduled': scheduled,
        'scheduled_revision_id': scheduled_revision_id,
        'scheduled_articles':scheduled_articles,

        'workflow': workflow,
        'workflow_states': workflow_states
        })