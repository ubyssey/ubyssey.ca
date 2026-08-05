import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.http import HttpResponse, JsonResponse
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
from wagtail.admin.templatetags.wagtailadmin_tags import avatar_url
from wagtail.documents import get_document_model
from wagtail.images import get_image_model
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from pycrdt import Doc

from stove.consumers import restore_group_name
from stove.models import ManuscriptCollaboration
from stove.manuscript_editor import (
    PAGE_FORM_FIELDS,
    get_page_form,
    get_article_authors_form,
    get_streamfield_editors,
    apply_editor_post,
    get_article_media_upload_form,
    get_article_media_tag_options,
    get_featured_media_form,
    add_article_media,
    save_article_media,
)
from stove.manuscript_editor.revisions import autosave_manuscript_revision


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
    username = request.GET.get('username', '')
    include_published = request.GET.get('include_published', '')
    
    qs = ArticlePage.objects.all()
    if (section != "all"):
        qs = qs.filter(current_section=section.lower())
    if (username):
        author_page = get_object_or_404(AuthorPage, full_name=username)
        qs = qs.filter(article_authors__author=author_page)
    if (include_published.lower() == "false"):
        qs = qs.filter(live=False)
    
    qs = qs.order_by("-latest_revision_created_at", "-pk")

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
@require_POST
def manuscript_collaboration(request, page_id):
    # Initalization before websockets kick in
    if not request.body or len(request.body) > 10 * 1024 * 1024:
        return HttpResponse(status=400)

    try:
        ydoc = Doc()
        ydoc.apply_update(request.body)
    except Exception:
        return HttpResponse(status=400)

    with transaction.atomic():
        page = get_object_or_404(
            Page.objects.select_for_update().only("pk"),
            pk=page_id,
        )
        session, _ = ManuscriptCollaboration.objects.get_or_create(page=page)
        if not session.document:
            session.document = request.body
            session.save(update_fields=["document", "updated_at"])
        document = bytes(session.document)

    return HttpResponse(document, content_type="application/octet-stream")


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

    stream_editors = get_streamfield_editors(page)
    article_media = page.article_media.all()
    last_saved_manuscript = ManuscriptCollaboration.objects.filter(page_id=page_id).only("updated_at").first()

    # self: contains information like page title, slug, etc, for form fields = for preview rendering
    # page_form: contains the form for the page fields
    # stream_editors: contains streamField names, block definitions, and preprocessed values
    # editor_errors: contains any errors from form submission
    # featured_media_form: contains the form for the featured media
    # article_media_upload_form: contains the form for uploading article media
    # article_media: contains the list of existing article images/documents in this page
    # last_saved_manuscript: sends last updated at for toolbar

    return render(
        request, "editors/manuscript_editor.html",
        {
            "self": page,
            "page_form": page_form,
            "public_page_form_fields": PAGE_FORM_FIELDS,
            "article_authors_form": article_authors_form,
            "stream_editors": stream_editors,
            "editor_errors": editor_errors,
            "current_editor": {
                "id": request.user.pk,
                "name": get_user_display_name(request.user),
                "avatar_url": avatar_url(request.user, size=64),
            },
            "featured_media_form": featured_media_form,
            "article_media_upload_form": get_article_media_upload_form(),
            "article_media": article_media,
            "last_saved_manuscript": last_saved_manuscript,
        },
    )


@login_required
@require_GET
def manuscript_authors(request, page_id):
    get_object_or_404(Page, id=page_id)
    authors = AuthorPage.objects.live().only("id", "title").order_by("title")

    return JsonResponse({"authors": [
        {"id": str(author.pk), "label": str(author)}
        for author in authors
    ]})


@login_required
@require_GET
def manuscript_media_tags(request, page_id):
    get_object_or_404(Page, id=page_id)
    return JsonResponse({"tags": get_article_media_tag_options()})


@login_required
@require_GET
def manuscript_media_options(request, page_id):
    get_object_or_404(Page, id=page_id)
    kind = request.GET.get("kind")
    query = request.GET.get("q", "").strip()[:100]
    model = get_image_model() if kind == "image" else get_document_model()
    media = model.objects.only("id", "title", "file")
    if query:
        media = media.filter(title__icontains=query).order_by("title", "id")
    else:
        media = media.order_by("-id")

    return JsonResponse(
        {"options": [
            {"value": str(item.id), "label": f"{item.title} — {item.filename}"}
            for item in media[:50]
        ]}
    )


@login_required
@require_GET
def manuscript_revisions(request, page_id):
    page = get_object_or_404(Page, id=page_id)
    revisions = page.revisions.select_related("user").only(
        "id",
        "created_at",
        "user_id",
        "user__first_name",
        "user__last_name",
        "user__email",
    ).order_by("-created_at")

    return JsonResponse({"revisions": [
        {
            "id": str(revision.id),
            "label": f"{get_user_display_name(revision.user)} {date_format(localtime(revision.created_at), 'M j, Y H:i')}",
        }
        for revision in revisions
    ]})


@login_required
@require_POST
def manuscript_restore(request, page_id):
    page = get_manuscript_page(page_id)
    revision_id = request.POST.get("revision")

    if not revision_id or revision_id == "current":
        return JsonResponse({"errors": {"revision": ["Choose a version to restore."]}}, status=400)

    revision = get_object_or_404(page.revisions, id=revision_id)
    restored_page = revision.as_object()

    # Attempts to save the last version of the page before restoration
    try:
        current_data = request.POST.copy()
        current_data.pop("revision", None)
        current_page = page.get_latest_revision_as_object()
        apply_editor_post(current_page, current_data)
        current_page.save_revision(user=request.user)

        saved_revision = restored_page.save_revision(user=request.user)
    except Exception:
        return JsonResponse({"errors": {"__all__": ["Failed to restore version."]}}, status=400)

    # Delete cause this is a full restore of the page not a change
    ManuscriptCollaboration.objects.filter(page_id=page_id).delete()
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            restore_group_name(page_id),
            {"type": "manuscript.restored"},
        )

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
        autosave_manuscript_revision(page_id, request.POST, request.user)

    return JsonResponse({
        "errors": editor_errors,
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
