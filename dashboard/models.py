from django.db import models, transaction
from django import forms

from wagtail.models import Task, TaskState, GroupApprovalTask
from wagtail.forms import TaskStateCommentForm

# Create your models here.

TIMELINESS_DAYS = "days"
TIMELINESS_WEEK = "week"
TIMELINESS_EVERGREEN = "evergreen"

TIMELINESS_CHOICES = (
    (TIMELINESS_DAYS, "A few days"),
    (TIMELINESS_WEEK, "A week"),
    (TIMELINESS_EVERGREEN, "Evergreen"),

)

class PublishingCommitteeApprovalTaskStateForm(TaskStateCommentForm):
    timeliness = forms.ChoiceField(
        choices=TIMELINESS_CHOICES
    )

class PublishingCommitteeApprovalTaskState(TaskState):
    timeliness = models.fields.CharField(
        choices=TIMELINESS_CHOICES,
        default=TIMELINESS_DAYS,
        max_length=50
    )

    @transaction.atomic
    def approve(self, user=None, update=True, comment="", timeliness=TIMELINESS_DAYS):
        self.timeliness = timeliness
        return super().approve(user, update, comment)


class PublishingCommitteeApprovalTask(GroupApprovalTask):
    task_state_class = PublishingCommitteeApprovalTaskState

    def get_actions(self, obj, user):
        if user.is_superuser or self._user_in_groups(user):
            return [
                ("reject", "Request changes", True),
                ("approve", "Approve", True),
            ]

        return []

    def get_form_for_action(self, action):
        if action == "reject":
            return TaskStateCommentForm
        
        return PublishingCommitteeApprovalTaskStateForm