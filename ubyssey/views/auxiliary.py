"""Production contexts for redesigned support landing pages.

These routes intentionally use live CMS data; fixture-backed preview views stay
restricted to local development.
"""

from types import SimpleNamespace

from django.core.paginator import Paginator
from django.http import Http404
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


def _auxiliary_context(request, page_kind):
    from specialfeaturelanding.models import RedesignAuxiliaryPage

    page = RedesignAuxiliaryPage.objects.live().filter(page_kind=page_kind).first()
    if page is None:
        raise Http404("The redesigned CMS page has not been created yet.")

    context = page.get_context(request)
    description = getattr(page.description, "source", str(page.description))
    context.update(
        {
            "self": page,
            "redesign_page_url": request.path,
            "meta": _meta(request, page.display_title, description),
        }
    )
    return page, context


def our_team(request):
    page, context = _auxiliary_context(request, "team")
    return render(request, page.get_template(request), context)


def contact(request):
    """Render the redesigned CMS-managed Contact directory at ``/contact/``."""
    page, context = _auxiliary_context(request, "contact")
    return render(request, page.get_template(request), context)


def video(request):
    from videos.models import VideoSnippet

    return render(
        request,
        "videos/videos_page.html",
        {
            "self": SimpleNamespace(title="Video"),
            "paginated_videos": Paginator(VideoSnippet.objects.all(), 15).get_page(
                request.GET.get("page")
            ),
            "redesign_page_url": request.path,
            "meta": _meta(request, "Video"),
        },
    )


def podcast(request):
    page, context = _auxiliary_context(request, "podcast")
    return render(request, page.get_template(request), context)
