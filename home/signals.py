from django.utils import timezone

from wagtail.signals import page_published
from wagtail.models import Workflow, WorkflowState, TaskState

from .models import HomePage
from article.models import ArticlePage


def publish_curated_article_drafts(sender, instance, **kwargs):
    articles = ArticlePage.objects.filter(id__in=instance.get_curated_articles())
    workflow = Workflow.objects.filter(name="Cabinet").first()
    print(workflow)
    
    for article in articles:
        if not article.live:
            article.latest_revision.publish()

        if workflow:
            state = workflow.workflow_states.filter(status="in_progress", object_id=article.id).first()
            print(state)
            if state:
                state.status = WorkflowState.STATUS_APPROVED
                state.save()
                print("approved?")
                task = state.current_task_state
                task.status = TaskState.STATUS_APPROVED
                task.finished_at = timezone.now()
                task.save()

page_published.connect(publish_curated_article_drafts, sender=HomePage)