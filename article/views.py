from datetime import datetime
import json
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse

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

STORY_TYPE_COPY = {
    "Report": "This article is a news report, which we define as a shorter story about events with immediate relevance, written from a detached perspective.",
    "Feature": "This article is a feature, which is a longer story about people or systems with long-term or widespread relevance, written from a reporter's perspective.",
    "Review": "This article is a review, which is a story about art or culture, written from a critical perspective.",
    "Game Analysis": "This article is a game analysis, which we define as a story about individual games, written from a reporter's perspective.",
    "Essay": "This article is an essay. In journalism, opinion essays refer to an author's views on the news, written from their own perspective but based on reporting.",
}


def _sample_story(slug):
    if not slug:
        return None, None
    sample_root = Path(__file__).resolve().parents[2] / "redesign" / "redesign_sample_content"
    for directory in ("section-news", "archive"):
        path = sample_root / directory / "content.json"
        if not path.exists():
            continue
        payload = json.loads(path.read_text())
        for story in payload.get("featured_stories", []) + payload.get("stories", []):
            if Path(urlparse(story.get("article_url", "")).path).name == slug:
                return story, directory
    return None, None


def _story_type(story):
    path = urlparse(story.get("article_url", "")).path
    title = story.get("headline", "").lower()
    if "/opinion/" in path:
        return "Essay"
    if "review" in title or path.endswith("-review/"):
        return "Review"
    if "/sports/" in path:
        return "Game Analysis"
    if any(word in title for word in ("data", "policy", "land trusts", "research")):
        return "Feature"
    return "Report"


def _author_fixture(name):
    """Return a production-shaped local author fixture when the team snapshot has one."""
    path = Path(__file__).resolve().parents[2] / "redesign" / "redesign_sample_content" / "our-team" / "content.json"
    if not path.exists():
        return None
    for person in json.loads(path.read_text()).get("people", []):
        if person.get("name") == name:
            portrait = person.get("portrait") or {}
            return {
                "bio": person.get("bio") or "",
                "image_url": f"/redesign-sample/our-team/{portrait['local_path']}" if portrait.get("local_path") else "",
            }
    return None


def _fixture_credit_contributors(story):
    """Infer non-author credits from the scraped display byline without changing CMS data."""
    if not story:
        return []
    byline = story.get("byline_text", "")
    lowered = byline.lower()
    markers = (
        ("photos by", "photographer"),
        ("photo by", "photographer"),
        ("videos by", "videographer"),
        ("video by", "videographer"),
        ("illustrations by", "illustrator"),
        ("illustration by", "illustrator"),
    )
    marker = next(((text, role) for text, role in markers if text in lowered), None)
    if not marker:
        return []
    credited_text = lowered.split(marker[0], 1)[1]
    contributors = []
    for item in story.get("authors", []):
        if item.get("text", "").lower() in credited_text:
            contributors.append(SimpleNamespace(
                author=SimpleNamespace(full_name=item.get("text", ""), url=item.get("url", "#")),
                author_alias="",
                author_role=marker[1],
            ))
    return contributors


def redesign_preview(request, layout):
    if layout not in LAYOUTS:
        raise Http404
    mapped_layout = "big-centered" if layout == "shared-components" else layout
    story, story_directory = _sample_story(request.GET.get("story"))
    story_authors = story.get("authors", []) if story else []
    primary = story_authors[0] if story_authors else {"text": "Juan Pablo Sastoque Vega", "url": "#"}
    author_fixture = _author_fixture(primary.get("text", "")) or {}
    author = SimpleNamespace(
        full_name=primary.get("text", "Juan Pablo Sastoque Vega"),
        url=primary.get("url", "#"),
        image=None,
        short_bio_description=author_fixture.get("bio") or "A contributor to The Ubyssey's reporting, analysis and cultural coverage.",
    )
    contributor = SimpleNamespace(author=author, author_alias="", author_role="author")
    editor = SimpleNamespace(
        author=SimpleNamespace(full_name="Elena Massing", url="#"),
        author_alias="",
        author_role="backfield_editor",
    )
    fixture_credits = _fixture_credit_contributors(story)
    if not story:
        fixture_credits = [SimpleNamespace(
            author=SimpleNamespace(full_name="Aleah Kippan", url="#"),
            author_alias="",
            author_role="photographer",
        )]
    lede = story.get("lede", "") if story else "Around a month after they had filed for third-party mediation, CUPE 2278 — the union representing TAs and GAAs — is holding a vote that could give them the power to call a strike."
    header = SimpleNamespace(value={
        "title": "",
        "subtitle": lede,
        "above_cut_lede": "",
    })
    story_type = _story_type(story) if story else "Report"
    story_path = urlparse(story.get("article_url", "")).path if story else "/news/"
    section = next((part for part in story_path.split("/") if part in {"news", "opinion", "arts", "culture", "sports"}), "news")
    preview = SimpleNamespace(
        title=story.get("headline", "Four Years In, Russia's War On Ukraine Reverberates On Campus") if story else "Four Years In, Russia's War On Ukraine Reverberates On Campus",
        redesign_header_layout=mapped_layout,
        full_bleed_nav_color="white",
        current_section=section.title(),
        category_page=SimpleNamespace(title="Campus" if section == "news" else section.title()),
        header=[header],
        lede="",
        featured_media=SimpleNamespace(first=SimpleNamespace(image=None, alt_text="A musician performs beside a Ukrainian flag at a candlelight vigil.", caption="Earlier that day, the Prime Minister weighed in.", credit="Photo by Aleah Kippan for The Ubyssey")),
        primary_author_orderable=contributor,
        published_at=datetime(2026, 3, 2),
        standpoint_disclosure=("<p>This contributor's relationship to the subject has been disclosed to editors. The disclosure is included so readers can evaluate the work with the relevant context.</p>" if story_type in {"Essay", "Feature"} or layout == "shared-components" else ""),
        story_type_description=STORY_TYPE_COPY[story_type],
        get_story_type_display=story_type,
        extended_contributors=[editor, *fixture_credits],
    )
    thumbnail = story.get("thumbnail", {}) if story else {}
    local_image = (f"/redesign-sample/{story_directory}/{thumbnail.get('local_path')}" if story and thumbnail.get("local_path") else "/redesign-sample/article-ukraine-vigil/media/header-four-years-in-russia-s-war-on-ukraine-reverberates-on-campus-ed5698f1.jpg")
    preview.featured_media = SimpleNamespace(first=SimpleNamespace(image=None, alt_text=thumbnail.get("alt_text", "A musician performs beside a Ukrainian flag at a candlelight vigil."), caption=thumbnail.get("caption", "Earlier that day, the Prime Minister weighed in."), credit=thumbnail.get("credit", "Photo by Aleah Kippan for The Ubyssey")))
    preview_body = [
        lede,
        "The reporting draws on interviews, public records and observations gathered by The Ubyssey. Editors reviewed the material for context, accuracy and relevance to the UBC community.",
        "People closest to the issue described how the decisions affect their daily lives, while institutional representatives outlined the policies and timelines shaping what comes next.",
        "The story remains part of a broader conversation on campus. The Ubyssey will continue following new information and will update its coverage when warranted.",
    ]
    return render(request, "article/redesign_preview.html", {
        "preview": preview,
        "preview_layout": layout,
        "preview_image_url": local_image,
        "preview_author_image_url": author_fixture.get("image_url", ""),
        "preview_body": preview_body,
        "show_preview_note": layout == "shared-components" or (story and Path(story_path).name == "ubc-needs-pleasures-of-table"),
        "meta": {"title": f"Article redesign preview — {layout}", "url": request.build_absolute_uri(), "description": "Local article redesign preview", "noindex": True},
    })
