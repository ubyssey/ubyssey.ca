from django.db import models
from django.utils.translation import gettext_lazy as _

from wagtail.models import Task, TaskState


class CopyEditTaskState(TaskState):
    class Meta:
        verbose_name = "Copy edit task state"
        verbose_name_plural = "Copy edit task states"


class CopyEditTask(Task):
    """
    A workflow task that routes an article to the copy editors group for
    fact-checking and grammatical review before it goes to the publish
    committee (Cabinet).
    """
    copy_editors_group = models.ForeignKey(
        'auth.Group',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Users in this group can approve or request changes on copy edit tasks.",
    )

    admin_form_fields = Task.admin_form_fields + ['copy_editors_group']
    task_state_class = CopyEditTaskState

    @classmethod
    def get_description(cls):
        return _("Members of the chosen group can perform copy editing on this task.")

    def user_can_access_editor(self, obj, user):
        return (
            self.copy_editors_group is not None
            and user.groups.filter(pk=self.copy_editors_group.pk).exists()
        )

    def locked_for_user(self, obj, user):
        return not self.user_can_access_editor(obj, user)

    def get_actions(self, obj, user):
        if (
            self.copy_editors_group is not None
            and user.groups.filter(pk=self.copy_editors_group.pk).exists()
        ):
            return [
                ('approve', _("Copy edit complete"), False),
                ('reject', _("Request changes"), True),
            ]
        return []

    def get_task_states_user_can_moderate(self, user, **kwargs):
        if (
            self.copy_editors_group is not None
            and user.groups.filter(pk=self.copy_editors_group.pk).exists()
        ):
            return TaskState.objects.filter(
                status=TaskState.STATUS_IN_PROGRESS,
                task=self.task_ptr,
            )
        return TaskState.objects.none()

    class Meta:
        verbose_name = "Copy edit task"
        verbose_name_plural = "Copy edit tasks"


class EngagementTaskState(TaskState):
    class Meta:
        verbose_name = "Engagement task state"
        verbose_name_plural = "Engagement task states"


class EngagementTask(Task):
    """
    A workflow task that notifies the Engagement team when an article is
    ready for promotion. The approver records the promotion type and any
    notes in the approval modal.
    """
    engagement_group = models.ForeignKey(
        'auth.Group',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Users in this group are responsible for promoting stories.",
    )

    admin_form_fields = Task.admin_form_fields + ['engagement_group']
    task_state_class = EngagementTaskState

    @classmethod
    def get_description(cls):
        return _("Notifies the Engagement team that a story is ready for promotion.")

    def user_can_access_editor(self, obj, user):
        return (
            self.engagement_group is not None
            and user.groups.filter(pk=self.engagement_group.pk).exists()
        )

    def locked_for_user(self, obj, user):
        return not self.user_can_access_editor(obj, user)

    def get_actions(self, obj, user):
        if (
            self.engagement_group is not None
            and user.groups.filter(pk=self.engagement_group.pk).exists()
        ):
            return [
                ('approve', _("Acknowledged — will promote"), True),
                ('reject', _("Not promoting this story"), True),
            ]
        return []

    def on_action(self, task_state, user, action_name, **kwargs):
        """
        When the engagement team approves, write promotion details back to
        the StoryAssignment linked to this article (if one exists).
        """
        result = super().on_action(task_state, user, action_name, **kwargs)

        if action_name == 'approve':
            comment = kwargs.get('comment', '')
            page = task_state.workflow_state.content_object
            if hasattr(page, 'assignment'):
                assignment = page.assignment
                assignment.promotion_ready = True
                if comment:
                    assignment.promotion_notes = comment
                assignment.save()

        return result

    def get_task_states_user_can_moderate(self, user, **kwargs):
        if (
            self.engagement_group is not None
            and user.groups.filter(pk=self.engagement_group.pk).exists()
        ):
            return TaskState.objects.filter(
                status=TaskState.STATUS_IN_PROGRESS,
                task=self.task_ptr,
            )
        return TaskState.objects.none()

    class Meta:
        verbose_name = "Engagement task"
        verbose_name_plural = "Engagement tasks"
