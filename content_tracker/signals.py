from django.template.loader import render_to_string
from django.utils.html import strip_tags
from wagtail.admin.mail import send_mail


def send_assignment_notification(assignment, author):
    """Send an email notification to an author who has been assigned a story."""
    if not hasattr(author, 'user') or author.user is None:
        logger.info(
            "Skipping notification for %s — no linked User account.",
            author.full_name,
        )
        return

    user = author.user
    if not user.email:
        return

    context = {
        'author_name': author.full_name,
        'subject': assignment.subject,
        'story_type': assignment.get_story_type_display(),
        'section': assignment.get_assigning_section_display(),
        'summary': assignment.summary,
        'memo': assignment.memo,
        'deadline': assignment.deadline,
        'target': assignment.target,
        'article_file_folder': assignment.article_file_folder,
        'manuscript': assignment.manuscript,
    }

    html_message = render_to_string(
        'content_tracker/emails/assignment_created.html',
        context,
    )
    plain_message = strip_tags(html_message)

    send_mail(
        subject=f"New assignment: {assignment.subject}",
        message=plain_message,
        recipient_list=[user.email],
        html_message=html_message,
    )
