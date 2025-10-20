from django.db import models
from django.utils import timezone

from wagtail.models import Orderable
from wagtail.snippets.models import register_snippet
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from wagtail.admin.panels import (
    FieldPanel,
    MultiFieldPanel,
    InlinePanel,
)

from article.models import ArticlePage

# Create your models here.
'''
StoryAssignment
    Article file folder (the Google Drive folder w/ sources, transcripts, etc)
    Manuscript (draft)
    Assigning section (non-visuals)
    Byline (free text, indexed)
    Deadline
    Target (publishing date)
    Visual requests
    State: assigned, editing, ready, and published.
    
    Summary
    Story type

    Article draft pointer

VisualAssignment
    Article assignment pointer
    Deadline
    Visuals or photo

    Rquest

    Image pointer

Spencer Slack message summary

This is what the assignment memo will look like and here is the VRF.
Some problems/design tensions with content trackers:
    * Surface active assignments, burry old assignments
    * Individualized vs Centralized 
    * Traffic james (too many articles set to publish at the same time)
    * The ideal content tracker allows, in one or more viewing panel:
    * Published articles to be removed from the ‘active zone’
    All Editors to see only their content in front of them when they want;
    All Editors to see which stories are being targeted for which day
'''

@register_snippet
class StoryAssignment(ClusterableModel):
    subject = models.CharField(max_length=50)

    story_type = models.CharField(max_length=50, choices=[
        ("event-report", "Event report"),
        ("essay", "Personal or Opinion essay"),
        ("review", "Review"),
        ("explainer", "Explainer/Guide"),
        ])    
    assigning_section = models.CharField(max_length=50, choices=[
        ("news", "News"),
        ("culture", "Culture"),
        ("features", "features"),
        ("opinion", "Opinion"),
        ("humour", "Humour"),
        ("research", "Research"),
        ("sports", "Sports"),
        ("photo", "Photo")
    ])    
    
    summary = models.TextField()

    article_file_folder = models.URLField()
    manuscript = models.URLField()

    created = models.DateTimeField(auto_now=True)
    deadline = models.DateField()
    target = models.DateField()

    class StateChoices(models.IntegerChoices):
        ASSIGNED = 1, ("Assigned")
        EDITING = 2, ("Editing")
        READY = 3, ("Ready")
        PUBLISHED = 4, ("Published")

    state = models.IntegerField(choices=StateChoices.choices, default=StateChoices.ASSIGNED.value)
    
    article_page = models.ForeignKey(ArticlePage, related_name="assignment", unique=True, on_delete=models.SET_NULL, null=True, blank=True)
    
    panels = [
        FieldPanel("subject"),
        FieldPanel("story_type"),
        FieldPanel("assigning_section"),
        FieldPanel("summary"),
        FieldPanel("article_file_folder"),
        FieldPanel("manuscript"),
        FieldPanel("deadline"),
        FieldPanel("target"),
        FieldPanel("state"),
        InlinePanel("story_assignees", label="Assignees"),        
        FieldPanel("article_page"),
    ]

    def __str__(self):
        return self.subject

class StoryAssignmentAssigneesOrderable(Orderable):
    assignment = ParentalKey(StoryAssignment, on_delete=models.CASCADE, related_name="story_assignees")
    assignee = models.ForeignKey("authors.AuthorPage", on_delete=models.CASCADE, related_name="story_assignments")

    panels = [
        MultiFieldPanel(
            [
                FieldPanel('assignee'),
            ],
            heading="Assignee"
        ),
    ]

@register_snippet
class VisualAssignment(ClusterableModel):
    story_assignment = models.ForeignKey(StoryAssignment, related_name="visual_requests", on_delete=models.CASCADE, null=True, blank=True)
    memo = models.URLField()
    
    created = models.DateTimeField(auto_now=True)
    deadline = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)

    class StateChoices(models.IntegerChoices):
        NEW = 0, ("New")
        ASSIGNED = 1, ("Assigned")
        COMPLETED = 2, ("Completed")

    state = models.IntegerField(choices=StateChoices.choices, default=StateChoices.NEW.value)

    request = models.TextField()
    visual_type = models.CharField(max_length=50, choices=[
        ("illustration", "Illustration"),
        ("photo", "Photo"),
        ("web-design", "Webdesign"),
    ])

    image = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    panels = [
        FieldPanel("story_assignment"),
        FieldPanel("memo"),
        FieldPanel("request"),
        FieldPanel("deadline"),
        FieldPanel("state"),
        InlinePanel("visual_assignees", label="Assignees"),
        FieldPanel("visual_type"),
        FieldPanel("image"),
    ]

    def save(self, *args, **kwargs):
        if "state" in kwargs:
            if kwargs["state"] == self.StateChoices.COMPLETED.value and self.complated_at == None:
                print(f"completed")
                self.complated_at = timezone.now()

        super(ClusterableModel, self).save(*args, **kwargs)

    def __str__(self):
        if self.story_assignment:
            return f"{self.story_assignment.subject} ({self.visual_type})"
        return f"{self.visual_type} - {self.request}"

class VisualAssignmentAssigneesOrderable(Orderable):
    assignment = ParentalKey(VisualAssignment, on_delete=models.CASCADE, related_name="visual_assignees")
    assignee = models.ForeignKey("authors.AuthorPage", on_delete=models.CASCADE, related_name="visual_assignments")

    panels = [
        MultiFieldPanel(
            [
                FieldPanel('assignee'),
            ],
            heading="Assignee"
        ),
    ]