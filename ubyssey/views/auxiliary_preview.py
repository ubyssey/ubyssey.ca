import json
import re
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from django.core.paginator import Paginator
from django.shortcuts import render


FIXTURE_ROOT = Path(__file__).resolve().parents[3] / "redesign" / "redesign_sample_content"


class FixtureCollection(list):
    def all(self):
        return self


def _read_fixture(name):
    with (FIXTURE_ROOT / name / "content.json").open() as source:
        return json.load(source)


def _date(value):
    value = value or "August 19, 2026"
    for pattern in ("%B %d, %Y", "%b. %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue
    return datetime(2026, 8, 19)


def _story(item, fixture):
    thumbnail = item.get("thumbnail") or {}
    return SimpleNamespace(
        title=item.get("headline", ""),
        lede=item.get("lede", ""),
        preview_url=item.get("article_url", "#"),
        preview_image=f"/redesign-sample/{fixture}/{thumbnail.get('local_path', '')}",
        preview_alt=thumbnail.get("alt_text", ""),
        authors_string=item.get("byline_html") or item.get("byline_text", ""),
        explicit_published_at=_date(item.get("date_attribute") or item.get("displayed_date")),
        current_section=item.get("section") or "Story",
        reading_time=None,
    )


def _listing(name):
    data = _read_fixture(name)
    return data, [_story(item, name) for item in data.get("stories", [])]


def _video(item):
    thumbnail = item.get("thumbnail") or {}
    source = thumbnail.get("source_url", "")
    match = re.search(r"/vi/([^/]+)/", source)
    video_id = match.group(1) if match else "T0PtNTrJStA"
    return SimpleNamespace(
        title=item.get("headline", ""),
        url=f"https://www.youtube.com/watch?v={video_id}",
        preview_image=f"/redesign-sample/video/{thumbnail.get('local_path', '')}",
        authors_string=item.get("byline_html") or item.get("byline_text", ""),
        created_at=_date(item.get("date_attribute") or item.get("displayed_date")),
    )


def _team_context():
    data = _read_fixture("our-team")
    groups = {"senior": [], "reportage": [], "visuals": [], "product": []}
    group_names = {
        "Senior Masthead": "senior",
        "Reportage": "reportage",
        "Visuals": "visuals",
        "Product": "product",
    }
    all_people = []
    for group in data.get("groups", []):
        key = group_names.get(group.get("heading"), "reportage")
        for item in group.get("people", []):
            portrait = item.get("portrait") or {}
            person = SimpleNamespace(
                full_name=item.get("name", ""),
                ubyssey_role=item.get("role", ""),
                short_bio_description=item.get("bio", ""),
                redesign_contact_email=(item.get("contact_lines") or [""])[0],
                preview_image=f"/redesign-sample/our-team/{portrait.get('local_path', '')}",
                preview_url=item.get("profile_url", "#"),
                image=None,
            )
            groups[key].append(person)
            all_people.append(person)
    return data, groups, all_people


def auxiliary_preview(request, page_key):
    template = {
        "video": "videos/videos_page.html",
        "photo": "section/photo_page.html",
        "podcast": "section/podcast_page.html",
        "margins": "section/margins_page.html",
        "archive": "archive/archive_page.html",
        "our-journalism": "support/our_journalism.html",
        "our-team": "support/our_team.html",
        "masthead": "support/masthead.html",
        "ups-board": "support/ups_board.html",
    }[page_key]
    page = SimpleNamespace(
        title=page_key.replace("-", " ").title(),
        description="",
        banner=None,
        featured_media=None,
        spotify_episode_url="https://open.spotify.com/episode/3JcrkvjI0i1WvC4ztaIBol",
        preview_url=request.path,
    )
    context = {
        "self": page,
        "redesign_preview_mode": True,
        "redesign_page_url": request.path,
        "meta": {"title": page.title, "description": "", "noindex": True},
    }

    if page_key == "video":
        data = _read_fixture("video")
        context["paginated_videos"] = Paginator(
            [_video(item) for item in data.get("stories", [])], 15
        ).get_page(request.GET.get("page"))
    elif page_key in {"photo", "margins", "podcast"}:
        fixture = "podcast-vilest-rag" if page_key == "podcast" else page_key
        data, stories = _listing(fixture)
        page.description = data.get("page", {}).get("description", "")
        context["redesign_all_articles"] = stories
    elif page_key == "archive":
        data, stories = _listing("archive")
        query = request.GET.get("q", "").strip()
        if query:
            needle = query.casefold()
            stories = [
                story for story in stories
                if needle in f"{story.title} {story.lede} {story.authors_string}".casefold()
            ]
        order = request.GET.get("order", "newest")
        stories.sort(key=lambda story: story.explicit_published_at, reverse=order != "oldest")
        page.sections_filters = FixtureCollection(
            SimpleNamespace(section_filter=SimpleNamespace(slug=slug, title=title))
            for slug, title in (
                ("news", "News"), ("culture", "Culture"), ("features", "Features"),
                ("opinion", "Opinion"), ("sports", "Sports & Rec"), ("photo", "Photo"),
            )
        )
        page_obj = Paginator(stories, 15).get_page(request.GET.get("page"))
        context.update({
            "q": query,
            "order": order,
            "year": request.GET.get("year", ""),
            "years": [2026, 2025, 2024, 2023, 2022, 2021, 2020],
            "selected_section": request.GET.get("section", ""),
            "content_type": request.GET.get("type", ""),
            "contributor": request.GET.get("contributor", ""),
            "series": request.GET.get("series", ""),
            "date_from": request.GET.get("from", ""),
            "date_to": request.GET.get("to", ""),
            "has_search": bool(request.GET),
            "recent_articles": stories[:5],
            "page_obj": page_obj,
            "result_count": page_obj.paginator.count,
            "video_section": False,
        })
    elif page_key in {"our-team", "masthead"}:
        data, groups, people = _team_context()
        page.preview_image = "/redesign-sample/our-team/" + data["page"]["hero_media"]["local_path"]
        context["redesign_staff_groups"] = groups
        context["redesign_staff"] = people

    return render(request, template, context)
