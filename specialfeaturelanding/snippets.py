import dispatch.models as dispatchmodels
from django.db import models
from django.db.models.fields.related import ForeignKey
from wagtail.admin.edit_handlers import FieldPanel
from wagtail.snippets.models import register_snippet


@register_snippet
class DispatchArticleSnippet(models.Model):
    def __init__(self):
        self.queryset = dispatchmodels.Article.objects.filter(is_published=1)

    article = ForeignKey(
        dispatchmodels.Article,
        on_delete=models.CASCADE,
        blank=False,
        null=False,
    )
    author = models.CharField(
        blank=True,
        null=True,
    )
    title = models.CharField(blank=True)

    panels = [
        FieldPanel("article"),
        FieldPanel("author"),
        FieldPanel("title"),
    ]

    def __str__(self):
        return "DispatchArticleSnippet for " % (str(self.article))

    class Meta:  # noqa
        indexes = [
            models.Index(fields=["article"]),
        ]
