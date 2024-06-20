from django.db import models
from images.models import UbysseyImage
from wagtail.snippets.models import register_snippet
from wagtail.admin.panels import FieldPanel

# Create your models here.
@register_snippet
class Event(models.Model):
    title = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    description = models.TextField(
        null=False,
        blank=True,
        default='',
    )
    start_time = models.DateTimeField(
        null=True,
        blank=True
    )
    end_time = models.DateTimeField(
        null=True,
        blank=True
    )
    location = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    organization = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    link = models.URLField(
        null=True,
        blank=True,
    )
    image = models.ForeignKey(
        "images.UbysseyImage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    panels = [
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("start_time"),
        FieldPanel("end_time"),
        FieldPanel("location"),
        FieldPanel("organization"),
        FieldPanel("link"),
        FieldPanel("image"),
    ]

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time']),
        ]
