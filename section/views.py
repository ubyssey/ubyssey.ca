import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from django.shortcuts import render


def _fixture_article(item, directory):
    thumbnail = item.get("thumbnail") or {}
    slug = item.get("article_url", "/").rstrip("/").split("/")[-1]
    date_text = item.get("date_attribute") or item.get("displayed_date") or "August 19, 2026"
    published = datetime(2026, 8, 19)
    for pattern in ("%B %d, %Y", "%b. %d, %Y", "%b %d, %Y"):
        try:
            published = datetime.strptime(date_text, pattern)
            break
        except ValueError:
            pass
    return SimpleNamespace(
        title=item.get("headline", ""), lede=item.get("lede", ""),
        preview_url=f"/redesign-preview/article/big-thumbnail/?story={slug}",
        preview_image=f"/redesign-sample/{directory}/{thumbnail.get('local_path', '')}",
        preview_alt=thumbnail.get("alt_text", ""), preview_byline=item.get("byline_text", ""),
        explicit_published_at=published,
    )


def redesign_preview(request):
    root = Path(__file__).resolve().parents[2] / "redesign" / "redesign_sample_content"
    with (root / "section-news" / "content.json").open() as source:
        data = json.load(source)
    featured_source = [*data.get("featured_stories", []), *data.get("stories", [])[:2]]
    featured = [_fixture_article(item, "section-news") for item in featured_source]
    articles = [_fixture_article(item, "section-news") for item in data.get("stories", [])[2:9]]
    page = SimpleNamespace(title=data["page"]["heading"], description=data["page"]["description"], slug="news", relative_url=lambda site: "/redesign-preview/section/", featured_articles=featured)
    editor = SimpleNamespace(name="Juan Pablo Sastoque Vega", email="news@ubyssey.ca", bio="Juan Pablo is the News Editor and a Political Science, International Relations and Economics student.", image="/redesign-sample/author-juan-pablo-sastoque-vega/media/juan-pablo-sastoque-vega-portrait-ecb35616.webp")
    topics = [SimpleNamespace(title=name, url="#") for name in ("AMS", "Senate", "Board of Governors", "Community", "Immigration", "Research Policy")]
    return render(request, "section/section_page.html", {"self": page, "redesign_page_url": "/redesign-preview/section/", "redesign_featured": featured, "redesign_articles": articles, "redesign_editor": editor, "redesign_topics": topics, "section_slug": "news", "meta": {"title": "Section redesign preview", "description": data["page"]["description"], "noindex": True}})

# Create your views here.
