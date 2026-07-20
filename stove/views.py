import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.utils.text import slugify
from wagtail.models import Page
from article.models import ArticlePage
from article.models import ArticleAuthorsOrderable
from section.models import CategoryPage
from authors.models import AuthorPage
from django.utils.dateformat import format as date_format
from django.utils.timezone import localtime
from django.views.decorators.http import require_GET, require_POST
from wagtail.documents import get_document_model
from wagtail.images import get_image_model
from wagtail.models import Page
from article.models import ArticlePage
from taggit.models import Tag

from stove.manuscript_editor import (
    PAGE_FORM_FIELDS,
    get_page_form,
    get_article_authors_form,
    get_streamfield_editors,
    apply_editor_post,
    get_article_media_upload_form,
    get_article_media_options,
    get_article_media_tag_options,
    get_featured_media_form,
    add_article_media,
    save_article_media,
)


# include editors, copy editors
@login_required
def content_tracker_react(request, section="all"):
    beats = CategoryPage.objects.all().filter(beat=True)
    authors = AuthorPage.objects.all().order_by("-last_activity", "-full_name", "-pk")

    beatExport = {}
    for beat in beats:
        beatSection = beat.get_parent().title
        if not beatSection in beatExport: 
            beatExport[beatSection] = []
        beatExport[beatSection] = beatExport[beatSection] + [{"value": beat.pk, "label": beat.title}]

    return render(request, "content_tracker_react.html", {"beats": json.dumps(beatExport), "authors": authors, "section": section})

@login_required
def load_pages(request, section="all", page=1):
    qs = ArticlePage.objects.all()
    if (section != "all"):
        qs = qs.filter(current_section=section.lower())
    
    qs = qs.order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 20)

    pages = paginator.get_page(request.GET.get("article-page", page))

    result="[]"
    if (len(pages) > 0):
        result = "["
        for page in pages: 
            result += page.get_latest_revision_as_object().to_json() + ","
        result = result[:-1] + "]"
    return JsonResponse(result, safe=False)


@login_required
def content_tracker_base(request):
    editable_pages = ["authorpage", "homepage", "standardarticlepage", "liveblogarticlepage", "sectionpage"]
    qs = ArticlePage.objects.all().order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("article-page", 1))
    
    beats = CategoryPage.objects.all().filter(beat=True)
    authors = AuthorPage.objects.all().order_by("-last_activity", "-full_name", "-pk")    

    return render(request, "content_tracker_base.html", {"pages": pages, "beats": beats, "authors": authors})

@login_required
@require_POST
def update_content_tracker(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific.get_latest_revision_as_object()
    data = request.body.decode('utf-8')
    data = json.loads(request.body.decode('utf-8'))

    if ("title" in data):
        page.title = data["title"]
    if ("category" in data):
        if (page.get_primary_topic()): page.topics.remove(page.get_primary_topic().name)
        page.topics.add(data["category"])
        page.primary_tag_slug = slugify(data["category"])
        page.category_page = get_object_or_404(CategoryPage, title=data["category"])
    if ("deadline" in data):
        page.deadline = data["deadline"]
    if ("article_status" in data):
        page.article_status = data["article_status"]
    if ("authors" in data):
        new_authors = data["authors"]  
        items = [
            ArticleAuthorsOrderable(
                author=get_object_or_404(AuthorPage, id=item["author"]),
                author_role=item["author_role"],
                sort_order=index,
            )
            for index, item in enumerate(new_authors or [])
        ]
        page.article_authors.set(items)

    page.save_revision(user=request.user)

    latest_revision = page.get_latest_revision_as_object()
    return JsonResponse(latest_revision.to_json(), safe=False)

@login_required
def manuscript_editor(request, page_id):
    page = get_manuscript_page(page_id)
    editor_errors = {}
    page_form = get_page_form(page)
    article_authors_form = get_article_authors_form(page)
    featured_media_form = get_featured_media_form(page)

    if request.method == "POST":
        action = request.POST.get("action") or "draft"
        saved_revision = None
        editor_errors, page_form, article_authors_form, featured_media_form = apply_editor_post(page, request.POST)

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
                "label": f"{get_user_display_name(saved_revision.user)} {date_format(localtime(saved_revision.created_at), 'M j, Y H:i')}",
            }
            return JsonResponse({"ok": True, "action": action, "revision": revision})

    if editor_errors:
        print(f"Validation Error: {editor_errors}")

    # History
    history = [
        {"id": str(revision.id), "user": get_user_display_name(revision.user), "created_at": revision.created_at}
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
         "public_page_form_fields": PAGE_FORM_FIELDS,
         "article_authors_form": article_authors_form,
         "stream_editors": stream_editors,
         "editor_errors": editor_errors,
         "history" : history,
         # Probably saved somewhere else here -> How did I do it for history?
         "current_editor_username": get_user_display_name(request.user),
         "featured_media_form": featured_media_form,
         "article_media_upload_form": get_article_media_upload_form(),
         "article_media_options": get_article_media_options(),
         "article_media_tag_options": get_article_media_tag_options(),
         "article_media": article_media}
    )


@login_required
@require_POST
def manuscript_restore(request, page_id):
    page = get_manuscript_page(page_id)
    revision_id = request.POST.get("revision")

    if not revision_id or revision_id == "current":
        return JsonResponse({"errors": {"revision": ["Choose a version to restore."]}}, status=400)

    revision = get_object_or_404(page.revisions, id=revision_id)
    restored_page = revision.as_object()
    try:
        saved_revision = restored_page.save_revision(user=request.user)
    except Exception:
        return JsonResponse({"errors": {"__all__": ["Failed to restore version."]}}, status=400)

    return JsonResponse({
        "ok": True,
        "revision": {
            "id": str(saved_revision.id),
            "label": f"{get_user_display_name(saved_revision.user)} {date_format(localtime(saved_revision.created_at), 'M j, Y H:i')}",
        }
    })


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
        article_authors_form = get_article_authors_form(page)
        featured_media_form = get_featured_media_form(page)
    else:
        editor_errors, page_form, article_authors_form, featured_media_form = apply_editor_post(page, request.POST, preview=True)

    if editor_errors:
        return JsonResponse({"errors": editor_errors}, status=400)

    return JsonResponse({
        "html": render_to_string(
            "editors/preview/manuscript_preview.html",
            {"self": page, "page_form": page_form, "article_authors_form": article_authors_form, "featured_media_form": featured_media_form},
            request=request,
        )
    })


@login_required
@require_GET
def manuscript_full_preview(request, page_id):
    page = get_manuscript_page(page_id)
    return page.make_preview_request(
        request,
        page.default_preview_mode,
    )


@login_required
@require_POST
def article_media_upload(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    form = get_article_media_upload_form(request.POST, request.FILES)

    if not form.is_valid():
        return JsonResponse({"errors": form.errors.get_json_data()}, status=400)

    item = save_article_media(page, form, request.user)
    if not item:
        return JsonResponse({"errors": {"file": [{"message": "Choose a file to upload."}]}}, status=400)

    return article_media_response(request, page, item)


@login_required
@require_POST
def article_media_add_existing(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    kind = request.POST.get("kind")
    media_id = request.POST.get("media_id")
    if kind not in ("image", "document") or not media_id or not media_id.isdigit():
        return JsonResponse({"errors": {"media": ["Choose valid media."]}}, status=400)

    is_image = kind == "image"
    model = get_image_model() if is_image else get_document_model()
    media = model.objects.filter(id=media_id).first()
    if not media:
        return JsonResponse({"errors": {"media": ["Media not found."]}}, status=404)

    item = add_article_media(page, media, is_image)
    return article_media_response(request, page, item)


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


#  Helpers

# We need latest draft here not latest live
def get_manuscript_page(page_id):
    page = get_object_or_404(Page, id=page_id).specific
    return page.get_latest_revision_as_object()


def get_user_display_name(user):
    if not user:
        return ""
    return user.get_full_name() or user.email


def article_media_response(request, page, item):
    article_media = page.article_media.all()
    media = item.image or item.document
    return JsonResponse({
        "item": {"kind": "image" if item.image else "document", "id": media.id, "title": media.title},
        "gallery": render_to_string("editors/components/article_media_gallery.html", {"article_media": article_media}, request=request)
    })
