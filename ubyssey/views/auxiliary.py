"""Production contexts for redesigned support landing pages.

These routes intentionally use live CMS data; fixture-backed preview views stay
restricted to local development.
"""
from types import SimpleNamespace

from django.core.paginator import Paginator
from django.shortcuts import render


def _meta(request, title, description=""):
    """Metadata for routes that are not backed by a Wagtail Page instance."""
    return {
        "title": f"{title} - The Ubyssey",
        "url": request.build_absolute_uri(),
        "description": description,
        "image": "",
        "noindex": False,
    }


def _staff_groups():
    from authors.models import AuthorPage

    groups = {"senior": [], "reportage": [], "visuals": [], "product": []}
    for person in AuthorPage.objects.live().exclude(ubyssey_role="").order_by("full_name"):
        role = person.ubyssey_role.casefold()
        if "editor-in-chief" in role or "managing editor" in role:
            groups["senior"].append(person)
        elif any(word in role for word in ("visual", "photo", "video", "illustr", "audio", "design")):
            groups["visuals"].append(person)
        elif any(word in role for word in ("product", "web", "developer", "engagement", "newsletter")):
            groups["product"].append(person)
        else:
            groups["reportage"].append(person)
    return groups


def our_team(request):
    from specialfeaturelanding.models import SpecialLandingPage

    # The public route intentionally resolves the same CMS page editors find
    # in Pages by searching for “Our Team”; it must not be a separate,
    # hard-coded rendering path.
    page = SpecialLandingPage.objects.filter(slug="our-team").first()
    return render(request, "support/our_team.html", {
        "self": page or SimpleNamespace(title="Our Team", featured_media=None),
        "redesign_staff_groups": _staff_groups(),
        "redesign_page_url": request.path,
        "meta": _meta(request, "Our Team"),
    })


def video(request):
    from videos.models import VideoSnippet

    return render(request, "videos/videos_page.html", {
        "self": SimpleNamespace(title="Video"),
        "paginated_videos": Paginator(VideoSnippet.objects.all(), 15).get_page(request.GET.get("page")),
        "redesign_page_url": request.path,
        "meta": _meta(request, "Video"),
    })


def podcast(request):
    from article.models import ArticlePage
    from specialfeaturelanding.models import SpecialLandingPage

    # This is the same Wagtail page editors find under Pages by searching for
    # “The Vilest Rag”. Keeping the public route and CMS source identical
    # makes its Spotify field and child-episode feed dependable.
    landing = SpecialLandingPage.objects.filter(slug="the-vilest-rag").first()
    episodes = ArticlePage.objects.none()
    if landing:
        episodes = ArticlePage.objects.live().public().descendant_of(landing).order_by("-explicit_published_at")[:20]
    page = landing or SimpleNamespace(
        title="The Vilest Rag", description="", spotify_episode_url=""
    )
    return render(request, "section/podcast_page.html", {
        "self": page,
        "redesign_all_articles": episodes,
        "redesign_page_url": request.path,
        "meta": _meta(request, "The Vilest Rag"),
    })
