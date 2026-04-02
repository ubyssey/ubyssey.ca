from wagtail.admin.ui.tables import UpdatedAtColumn
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from article.models import ArticleTopic


class ArticleTopicViewSet(SnippetViewSet):
    model = ArticleTopic
    icon = "pick"
    list_display = ["name", "recent_sections", "tagged_articles_count", "last_used_at", "listed", UpdatedAtColumn()]
    list_per_page = 50
    copy_view_enabled = False
    inspect_view_enabled = True
    search_fields = ["name"]
    ordering = "-last_used_at"

    list_export = ["name", "tagged_articles_count", "most_frequent_section", "last_used_at"]
