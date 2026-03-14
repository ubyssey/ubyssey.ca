"""
Email handlers for CopyEditTask and EngagementTask workflow events.

Uses Django's task_submitted / task_approved / task_rejected signals directly,
since Wagtail 5.2's EmailNotificationMixin is not available as a public API.
Handlers are connected at the bottom of this module and registered when Django
starts via ContentTrackerConfig.ready().
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

from wagtail.signals import task_submitted, task_approved, task_rejected

logger = logging.getLogger(__name__)

_FROM = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ubyssey.ca')


def _send(subject, message, recipients):
    if not recipients:
        return
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=_FROM,
            recipient_list=recipients,
            fail_silently=False,
        )
        logger.info("Sent '%s' to %s", subject, recipients)
    except Exception:
        logger.exception("Failed to send '%s'", subject)


def _emails_for_group(group):
    """Return a list of email addresses for all active users in a group."""
    if group is None:
        return []
    return list(
        group.user_set.filter(is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )


def _emails_for_page_authors(page):
    """Return a list of email addresses for authors linked to a page."""
    emails = []
    if not hasattr(page, 'article_authors'):
        return emails
    for orderable in page.article_authors.all():
        author = orderable.author
        if hasattr(author, 'user') and author.user and author.user.is_active and author.user.email:
            emails.append(author.user.email)
    return emails


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def _on_task_submitted(sender, instance, user, **kwargs):
    """
    instance is a TaskState. Dispatch to the right handler based on the
    specific Task subclass.
    """
    # Lazy import to avoid circular imports at module load time
    from content_tracker.tasks import CopyEditTask, EngagementTask

    task = instance.task.specific
    page = instance.workflow_state.content_object

    if isinstance(task, CopyEditTask):
        recipients = _emails_for_group(task.copy_editors_group)
        title = getattr(page, 'title', str(page))
        _send(
            subject=f"[Copy edit needed] {title}",
            message=(
                f"The article \"{title}\" has been submitted for copy editing.\n\n"
                f"Open it in the CMS to review and approve or request changes.\n"
            ),
            recipients=recipients,
        )

    elif isinstance(task, EngagementTask):
        recipients = _emails_for_group(task.engagement_group)
        title = getattr(page, 'title', str(page))
        _send(
            subject=f"[Promotion needed] {title}",
            message=(
                f"The article \"{title}\" is ready for promotion.\n\n"
                f"Open it in the CMS to acknowledge or decline promotion.\n"
            ),
            recipients=recipients,
        )


def _on_task_approved(sender, instance, user, **kwargs):
    from content_tracker.tasks import CopyEditTask

    task = instance.task.specific
    page = instance.workflow_state.content_object

    if isinstance(task, CopyEditTask):
        recipients = _emails_for_page_authors(page)
        title = getattr(page, 'title', str(page))
        _send(
            subject=f"[Copy edit complete] {title}",
            message=(
                f"Copy editing on \"{title}\" has been marked complete.\n\n"
                f"The article is now moving to the next step in the workflow.\n"
            ),
            recipients=recipients,
        )


def _on_task_rejected(sender, instance, user, **kwargs):
    from content_tracker.tasks import CopyEditTask

    task = instance.task.specific
    page = instance.workflow_state.content_object

    if isinstance(task, CopyEditTask):
        recipients = _emails_for_page_authors(page)
        title = getattr(page, 'title', str(page))
        comment = getattr(instance, 'comment', '') or ''
        body = f"Changes have been requested on \"{title}\" during copy editing.\n"
        if comment:
            body += f"\nNote from copy editor:\n{comment}\n"
        body += "\nPlease address the feedback and resubmit.\n"
        _send(
            subject=f"[Changes requested] {title}",
            message=body,
            recipients=recipients,
        )


# ---------------------------------------------------------------------------
# Connect handlers
# ---------------------------------------------------------------------------

task_submitted.connect(_on_task_submitted, dispatch_uid='content_tracker_task_submitted')
task_approved.connect(_on_task_approved, dispatch_uid='content_tracker_task_approved')
task_rejected.connect(_on_task_rejected, dispatch_uid='content_tracker_task_rejected')
