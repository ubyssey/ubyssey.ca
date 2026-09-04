from datetime import datetime
from types import SimpleNamespace

from django.http import Http404
from django.shortcuts import render
from wagtail.admin.ui.tables import UpdatedAtColumn
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


LAYOUTS = {"big-centered", "body-width", "left-aligned", "right-aligned", "full-bleed", "shared-components"}


def redesign_preview(request, layout):
    if layout not in LAYOUTS:
        raise Http404
    mapped_layout = "big-centered" if layout == "shared-components" else layout
    author = SimpleNamespace(
        full_name="Juan Pablo Sastoque Vega",
        url="#",
        image=None,
        short_bio_description="Juan Pablo is a fourth-year political science student and a News Editor for The Ubyssey's 108th Editorial.",
    )
    contributor = SimpleNamespace(author=author, author_alias="", author_role="author")
    editor = SimpleNamespace(
        author=SimpleNamespace(full_name="Elena Massing", url="#"),
        author_alias="",
        author_role="backfield_editor",
    )
    photographer = SimpleNamespace(
        author=SimpleNamespace(full_name="Aleah Kippan", url="#"),
        author_alias="",
        author_role="photographer",
    )
    header = SimpleNamespace(value={
        "title": "",
        "subtitle": "Around a month after they had filed for third-party mediation, CUPE 2278 — the union representing TAs and GAAs — is holding a vote that could give them the power to call a strike.",
        "above_cut_lede": "",
    })
    preview = SimpleNamespace(
        title="Four Years In, Russia's War On Ukraine Reverberates On Campus",
        redesign_header_layout=mapped_layout,
        full_bleed_nav_color="white",
        current_section="News",
        category_page=SimpleNamespace(title="Campus"),
        header=[header],
        lede="",
        featured_media=SimpleNamespace(first=SimpleNamespace(image=None, alt_text="A musician performs beside a Ukrainian flag at a candlelight vigil.", caption="Earlier that day, the Prime Minister weighed in.", credit="Photo by Aleah Kippan for The Ubyssey")),
        primary_author_orderable=contributor,
        published_at=datetime(2026, 3, 2),
        standpoint_disclosure="<p>This reporter has covered UBC governance and has no personal or financial relationship with the subjects of this story.</p>",
        story_type_description="Reports are shorter stories about events with immediate relevance, written from a detached perspective.",
        get_story_type_display="Report",
        extended_contributors=[editor, photographer],
    )
    return render(request, "article/redesign_preview.html", {
        "preview": preview,
        "preview_layout": layout,
        "preview_image_url": "/redesign-sample/article-ukraine-vigil/media/header-four-years-in-russia-s-war-on-ukraine-reverberates-on-campus-ed5698f1.jpg",
        "preview_author_image_url": "/redesign-sample/article-ukraine-vigil/media/author-01-juan-pablo-sastoque-vega-c1da1179.webp",
        "meta": {"title": f"Article redesign preview — {layout}", "url": request.build_absolute_uri(), "description": "Local article redesign preview", "noindex": True},
    })
