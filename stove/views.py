import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.utils.dateformat import format as date_format
from django.utils.timezone import localtime
from django.views.decorators.http import require_POST
from wagtail.models import Page
from article.models import ArticlePage

from stove.editor import (
    get_page_form,
    get_streamfield_editors,
    apply_editor_post,
    get_article_media_upload_form,
    get_featured_media_form,
    save_article_media_upload
)


@login_required
def index(request):
    editable_pages = ["authorpage", "homepage", "standardarticlepage", "liveblogarticlepage", "sectionpage"]
    qs = ArticlePage.objects.all().order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("article-page", 1))

    return render(request, "index.html", {"pages": pages})


# We need latest draft here not latest live
def get_manuscript_page(page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return page.get_latest_revision_as_object()


@login_required
def manuscript_editor(request, page_id):
    page = get_manuscript_page(page_id)
    editor_errors = {}
    page_form = get_page_form(page)
    featured_media_form = get_featured_media_form(page)

    if request.method == "POST":
        action = request.POST.get("action") or "draft"
        saved_revision = None
        editor_errors, page_form, featured_media_form = apply_editor_post(page, request.POST)

        if not editor_errors:
            siblings = page.get_siblings().exclude(id=page.id)
            if siblings.filter(slug=page.slug).exists():
                editor_errors["slug"] = ["Slug must be unique among siblings."]
            else:
                try:
                    page.full_clean()
                except ValidationError as e:
                    for field, field_errors in e.message_dict.items():
                        editor_errors.setdefault(field, []).extend(field_errors)
                else:
                    try:
                        saved_revision = page.save_revision(user=request.user)
                        if action == "publish":
                            saved_revision.publish(user=request.user)
                            page = get_object_or_404(Page, id=page_id).specific
                            print("Revised page")
                        else:
                            print("Draft Saved")
                    except Exception:
                        editor_errors["__all__"] = ["Failed to update page."]
                        print("Failed to update page:" + page.title)

        if request.headers.get("x-requested-with") == "XMLHttpRequest" or "application/json" in request.headers.get("accept", ""):
            if editor_errors:
                return JsonResponse({"errors": editor_errors}, status=400)
            revision = saved_revision and {
                "id": str(saved_revision.id),
                "label": f"{saved_revision.user} {date_format(localtime(saved_revision.created_at), 'M j, Y H:i')}",
            }
            return JsonResponse({"ok": True, "action": action, "revision": revision})

    if editor_errors:
        print(f"Validation Error: {editor_errors}")

    # History
    history = [
        {"id": str(revision.id), "user": str(revision.user), "created_at": revision.created_at}
        for revision in page.revisions.all().order_by("-created_at")
    ]

    stream_editors = get_streamfield_editors(page)
    article_media = page.article_media.all()

    # self: contains information like page title, slug, etc, for form fields = for preview rendering
    # page_form: contains the form for the page fields
    # stream_editors: contains streamField names, block definitions, and preprocessed values
    # editor_errors: contains any errors from form submission
    # history: contains the revision history for this page
    # featured_media_form: contains the form for the featured media
    # article_media_upload_form: contains the form for uploading article media
    # article_media: contains the list of existing article images/documents in this page

    return render(
        request, "editors/manuscript_editor.html",
        {"self": page,
         "page_form": page_form,
         "stream_editors": stream_editors,
         "editor_errors": editor_errors,
         "history" : history,
         # Probably saved somewhere else here -> How did I do it for history?
         "current_editor_username": str(request.user),
         "featured_media_form": featured_media_form,
         "article_media_upload_form": get_article_media_upload_form(),
         "article_media": article_media}
    )


@login_required
@require_POST
def manuscript_preview(request, page_id):
    page = get_manuscript_page(page_id)
    editor_errors = {}

    revision_id = request.POST.get("revision")
    if revision_id and revision_id != "current":
        revision = get_object_or_404(page.revisions, id=revision_id)
        page = revision.as_object()
        page_form = get_page_form(page)
        featured_media_form = get_featured_media_form(page)
    else:
        editor_errors, page_form, featured_media_form = apply_editor_post(page, request.POST, preview=True)

    if editor_errors:
        return JsonResponse({"errors": editor_errors}, status=400)

    return JsonResponse({
        "html": render_to_string(
            "editors/preview/manuscript_preview.html",
            {"self": page, "page_form": page_form, "featured_media_form": featured_media_form},
            request=request,
        )
    })


@login_required
@require_POST
def article_media_upload(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    form = get_article_media_upload_form(request.POST, request.FILES)

    if not form.is_valid():
        return JsonResponse({"errors": form.errors.get_json_data()}, status=400)

    item = save_article_media_upload(page, form, request.user)
    if not item:
        return JsonResponse({"errors": {"file": [{"message": "Choose a file to upload."}]}}, status=400)

    article_media = page.article_media.all()
    media = item.image or item.document
    return JsonResponse({
        "item": {"kind": "image" if item.image else "document", "id": media.id, "title": media.title},
        "gallery": render_to_string("editors/components/article_media_gallery.html", {"article_media": article_media}, request=request)
    })


@login_required
def homepage_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return render(request, "editors/homepage_editor.html", {"self": page})


@login_required
def author_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return render(request, "editors/author_editor.html", {"self": page})


@login_required
def liveblog_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return render(request, "editors/liveblog_editor.html", {"self": page})


@login_required
def section_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return render(request, "editors/section_editor.html", {"self": page})
