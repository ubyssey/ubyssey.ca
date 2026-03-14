from django.db import models
from django.utils import timezone

from wagtail.models import Orderable
from wagtail.fields import StreamField, RichTextField
from wagtail.images.blocks import ImageChooserBlock
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from wagtail.admin.panels import (
    FieldPanel,
    FieldRowPanel,
    HelpPanel,
    MultiFieldPanel,
    InlinePanel,
    ObjectList,
    TabbedInterface,
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

class StoryAssignment(ClusterableModel):
    subject = models.CharField(max_length=50)

    story_type = models.CharField(max_length=50, choices=[
        ("event-report", "Event report"),
        ("extended-report", "Extended report"),
        ("public-service-announcement", "Public Service Announcement"),
        ("opinion-essay", "Opinion essay"),
        ("personal-essay", "Personal essay"),
        ("review", "Review"),
        ("guide", "Guide"),
        ("explainer", "Explainer"),
        ("profile", "Profile"),
        ("q_&_a", "Q&A"),
        ("humour", "Humour"),
    ])
    assigning_section = models.CharField(max_length=50, choices=[
        ("news", "News"),
        ("culture", "Culture"),
        ("features", "Features"),
        ("opinion", "Opinion"),
        ("humour", "Humour"),
        ("research", "Research"),
        ("sports", "Sports"),
        ("photo", "Photo"),
    ])

    summary = models.TextField()

    memo = RichTextField(
        blank=True,
        help_text="Rich-text assignment brief for the reporter. Replaces external assignment memo documents.",
    )

    article_file_folder = models.URLField(blank=True)
    manuscript = models.URLField(blank=True)

    created = models.DateTimeField(auto_now_add=True)
    deadline = models.DateField()
    target = models.DateField()
    calendar_date = models.DateField(
        null=True, blank=True,
        help_text="Pin this assignment to a specific date on the editorial calendar.",
    )

    class StateChoices(models.IntegerChoices):
        ASSIGNED = 1, ("Assigned")
        EDITING = 2, ("Editing")
        READY = 3, ("Ready")
        PUBLISHED = 4, ("Published")

    state = models.IntegerField(choices=StateChoices.choices, default=StateChoices.ASSIGNED.value)

    article_page = models.OneToOneField(ArticlePage, related_name="assignment", on_delete=models.SET_NULL, null=True, blank=True)

    is_print = models.BooleanField(default=False, verbose_name="Bound for print")
    is_podcast = models.BooleanField(default=False, verbose_name="Bound for podcast")

    promotion_ready = models.BooleanField(default=False, verbose_name="Ready for promotion")
    promotion_type = models.CharField(
        max_length=50,
        blank=True,
        choices=[
            ("social", "Social media"),
            ("newsletter", "Newsletter"),
            ("podcast", "Podcast"),
            ("print", "Print"),
            ("social+newsletter", "Social + Newsletter"),
        ],
    )
    promotion_notes = models.TextField(blank=True)

    assignment_panels = [
        FieldPanel("subject"),
        FieldPanel("story_type"),
        FieldPanel("assigning_section"),
        FieldPanel("summary"),
        FieldPanel("memo"),
        InlinePanel("story_assignees", label="Assignees"),
    ]

    schedule_panels = [
        FieldRowPanel([
            FieldPanel("deadline"),
            FieldPanel("target"),
        ]),
        FieldPanel("calendar_date"),
        FieldPanel("state"),
    ]

    draft_panels = [
        HelpPanel(content="<p>Link external documents and the CMS article page for this assignment.</p>"),
        FieldPanel("article_file_folder"),
        FieldPanel("manuscript"),
        FieldPanel("article_page"),
    ]

    promotion_panels = [
        MultiFieldPanel(
            [
                FieldRowPanel([
                    FieldPanel("is_print"),
                    FieldPanel("is_podcast"),
                ]),
            ],
            heading="Derivative products",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                FieldPanel("promotion_ready"),
                FieldPanel("promotion_type"),
                FieldPanel("promotion_notes"),
            ],
            heading="Engagement handoff",
            classname="collapsible collapsed",
        ),
    ]

    edit_handler = TabbedInterface([
        ObjectList(assignment_panels, heading="Assignment"),
        ObjectList(schedule_panels, heading="Schedule"),
        ObjectList(draft_panels, heading="Draft"),
        ObjectList(promotion_panels, heading="Promotion"),
    ])

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

class VisualAssignment(ClusterableModel):
    story_assignment = models.ForeignKey(StoryAssignment, related_name="visual_requests", on_delete=models.CASCADE, null=True, blank=True)
    memo = models.URLField(verbose_name="Visual request form")
    
    created = models.DateTimeField(auto_now=True)
    deadline = models.DateField()
    completed = models.DateTimeField(null=True, blank=True)

    class StateChoices(models.IntegerChoices):
        NEW = 0, ("New")
        ASSIGNED = 1, ("Assigned")
        COMPLETED = 2, ("Completed")

    state = models.IntegerField(choices=StateChoices.choices, default=StateChoices.NEW.value)

    intended_use = models.CharField(max_length=50, choices=[
        ("print", "For print"),
        ("web", "For web"),
        ("web & print", "For web and print"),
    ], default="unspecified")
    
    request = models.TextField()
    visual_type = models.CharField(max_length=50, choices=[
        ("illustration", "Illustration"),
        ("photo", "Photo"),
        ("video", "Video"),
        ("web-design", "Web design"),
    ])

    visuals = StreamField([
        ("image", ImageChooserBlock(required=True))
    ],
    use_json_field=True, null=True, blank=True)

    panels = [
        FieldPanel("story_assignment"),
        FieldPanel("memo"),
        FieldPanel("request"),
        FieldPanel("deadline"),
        FieldPanel("intended_use"),
        FieldPanel("state"),
        InlinePanel("visual_assignees", label="Assignees"),
        FieldPanel("visual_type"),
        FieldPanel("visuals"),
    ]

    def save(self, *args, **kwargs):

        if self.state == self.StateChoices.COMPLETED.value and self.completed == None:
            self.completed = timezone.now()
        elif self.state != self.StateChoices.COMPLETED.value and self.completed != None:
            self.completed = None

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