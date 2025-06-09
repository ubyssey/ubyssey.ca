from django.shortcuts import render

# Create your views here.
from wagtail.admin.panels import FieldPanel, ObjectList, TabbedInterface
from wagtail.admin.ui.tables import UpdatedAtColumn
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from article.models import ArticleTopic, ArticleTopicFilterSet

class ArticleTopicViewSet(SnippetViewSet):
    model = ArticleTopic
    icon = "pick"
    list_display = ["name", "recent_sections", "tagged_articles_count", "last_used_at", "listed", UpdatedAtColumn()]
    list_per_page = 50
    copy_view_enabled = False
    inspect_view_enabled = True

    filterset_class = ArticleTopicFilterSet
    search_fields = ["name"]
    ordering = "-last_used_at"

    list_export = ["name", "tagged_articles_count", "most_frequent_section", "last_used_at"]