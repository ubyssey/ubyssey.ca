import json
import re
from pathlib import Path
from types import SimpleNamespace

from django.shortcuts import render
from wagtail.admin.viewsets.chooser import ChooserViewSet
from .models import AuthorPage
from django.db.models import F
from wagtail.admin.views.generic.chooser import (
    BaseChooseView, ChooseViewMixin, CreationFormMixin
)
from wagtail.admin.ui.tables import Column, TitleColumn

class BaseAuthorPageChooseView(BaseChooseView):
    @property
    def columns(self):
        return [
            self.title_column,
            Column(
                "last_activity", label="Last Activity", accessor="last_activity"
            )
        ]

class AuthorPageChooseView(ChooseViewMixin, CreationFormMixin, BaseAuthorPageChooseView):
    pass

class AuthorPageViewSet(ChooserViewSet):
    model = AuthorPage
    per_page = 50
    choose_view_class = AuthorPageChooseView
    
    def get_queryset(self):
        return AuthorPage.objects

    def get_object_list(self):
        return AuthorPage.objects.order_by(F('last_activity').desc(nulls_last=True), F('first_published_at').desc(nulls_last=True))
    

author_chooser_viewset = AuthorPageViewSet("author_chooser")


def redesign_preview(request):
    from section.views import _fixture_article

    root = Path(__file__).resolve().parents[2] / "redesign" / "redesign_sample_content"
    with (root / "author-juan-pablo-sastoque-vega" / "content.json").open() as source:
        data = json.load(source)
    stories = [_fixture_article(item, "author-juan-pablo-sastoque-vega") for item in data.get("stories", [])]
    description = data["page"].get("meta_description", "")
    email_match = re.search(r"[\w.+'-]+@[\w.-]+\.[A-Za-z]{2,}", description)
    page = SimpleNamespace(title="Juan Pablo Sastoque Vega", slug="juan-pablo-sastoque-vega", ubyssey_role="News Editor", bio_description=description.split(" You can reach", 1)[0])
    return render(request, "authors/author_page.html", {
        "self": page, "redesign_preview_mode": True, "redesign_page_url": "/redesign-preview/author/",
        "redesign_profile_image": "/redesign-sample/author-juan-pablo-sastoque-vega/media/juan-pablo-sastoque-vega-portrait-ecb35616.webp",
        "redesign_email": email_match.group(0) if email_match else "jp.sastoque@ubyssey.ca",
        "redesign_pinned": stories[:3], "redesign_articles": stories[3:7],
        "media_types": [("articles", "Articles"), ("visuals", "Visuals"), ("photos", "Gallery"), ("margins", "Margins")],
        "media_type": "articles", "meta": {"title": "Author redesign preview", "description": description, "noindex": True},
    })
