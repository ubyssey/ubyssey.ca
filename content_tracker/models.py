from django.db import models

from wagtail.snippets.models import register_snippet

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
class StoryAssignment(models.Model):
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
    
    state = models.CharField(max_length=50, choices=[
        ("assigned", "Assigned"),
        ("editing", "Editing"),
        ("ready", "Ready"),
        ("published", "Published")
        ],
        default="assigned")
    
    article_page = models.ForeignKey(ArticlePage, on_delete=models.SET_NULL, null=True, blank=True)
    
    def __str__(self):
        return self.subject


@register_snippet
class VisualAssignment(models.Model):
    StoryAssignment = models.ForeignKey(StoryAssignment, on_delete=models.CASCADE, null=True, blank=True)
    memo = models.URLField()
    
    created = models.DateTimeField(auto_now=True)
    deadline = models.DateField()

    state = models.CharField(max_length=50, choices=[
        ("assigned", "Assigned"), 
        ("in_progress", "In progress"),
         ("completed", "Completed")
         ],
         default="assigned")

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
