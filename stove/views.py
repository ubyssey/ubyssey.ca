import json
import warnings

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.http import HttpResponse, JsonResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.utils.text import slugify
from wagtail.models import Page
from article.models import ArticlePage, StandardArticlePage, ArticleDeadline
from article.models import ArticleAuthorsOrderable
from section.models import CategoryPage, SectionPage
from authors.models import AuthorPage
from django.utils.dateformat import format as date_format
from django.utils.timezone import localtime
from django.views.decorators.http import require_GET, require_POST
from wagtail.admin.templatetags.wagtailadmin_tags import avatar_url
from wagtail.documents import get_document_model
from wagtail.images import get_image_model
from pycrdt import Array, Doc, Map

from stove.editors.collaboration.persistence import (
    ASSIGNMENT_AUTHOR_ROLES,
    initialize_page_collaboration,
    update_page_collaboration,
)
from stove.models import PageCollaboration
from stove.editors.manuscript.media import (
    add_article_media,
    get_article_media_tag_options,
    get_article_media_upload_form,
    save_article_media,
)
from stove.editors.manuscript.forms.authors import create_form as create_article_authors_form
from stove.editors.manuscript.forms.featured_media import create_form as create_featured_media_form
from stove.editors.manuscript.forms.metadata import PAGE_FORM_FIELDS, create_form as create_page_form
from stove.editors.manuscript.schema import get_streamfield_editors
from stove.editors.manuscript.preview import prepare_preview
from stove.editors.manuscript.submission import process_submitted_page
from stove.editors.collaboration.revisions import (
    restore_page_revision,
    save_page_revision,
    autosave_manuscript_revision,
)


# include editors, copy editors
@login_required
def content_tracker_react(request, section="all"):
    beats = CategoryPage.objects.all().filter(beat=True)
    authors = AuthorPage.objects.all().order_by("-last_activity", "-full_name", "-pk")
    sections = SectionPage.objects.exact_type(SectionPage)

    beatExport = {}
    for beat in beats:
        beatSection = beat.get_parent().title
        if not beatSection in beatExport: 
            beatExport[beatSection] = []
        beatExport[beatSection] = beatExport[beatSection] + [{"value": beat.pk, "label": beat.title}]

    sectionExport = []
    for s in sections:
        sectionExport = sectionExport + [{"value": s.pk, "label": s.title, "slug": s.slug}]

    return render(request, "content_tracker_react.html", {"beats": json.dumps(beatExport), "authors": authors, "sections": sectionExport, "section": section})

@login_required
def load_pages(request, section="all", page=1):
    username = request.GET.get('username', '')
    include_published = request.GET.get('include_published', '')
    
    qs = ArticlePage.objects.all()
    if (section != "all"):
        qs = qs.child_of(get_object_or_404(SectionPage, slug=section.lower()))
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
def create_page(request, section_id):
    data = request.body.decode('utf-8')
    data = json.loads(request.body.decode('utf-8'))

    if not data['title']:
        response = HttpResponseBadRequest("Title needed to create page")
        return response
    section = get_object_or_404(SectionPage, pk=section_id)

    newPage = StandardArticlePage(
        title=data["title"],
        depth=4,
        slug=slugify(data["title"]),
        live=False
    )

    if "assignment_folder" in data:
        newPage.assignment_folder = data["assignment_folder"]
    if "deadline_list" in data:
        for deadline in data["deadline_list"]: 
            newPage.deadline_list = list(newPage.deadline_list.all()) + [
                    ArticleDeadline(
                        description=deadline.get("description"),
                        date=deadline.get("date"),
                        completed=deadline.get("completed")
                    )
                ]
    if ("category_page" in data):
        if (newPage.get_primary_topic()): newPage.topics.remove(newPage.get_primary_topic().name)
        try: 
            newPage.category_page = get_object_or_404(CategoryPage, pk=data["category_page"])
        except: 
            return HttpResponseBadRequest('Unable to find category page') 
        newPage.topics.add(newPage.category_page.title)
        newPage.primary_tag_slug = slugify(newPage.category_page.title)
    if ("article_status" in data):
        newPage.article_status = data["article_status"]
    if ("article_authors" in data):
        new_authors = data["article_authors"]  
        items = [
            ArticleAuthorsOrderable(
                author=get_object_or_404(AuthorPage, id=item["author"]),
                author_role=item["author_role"],
                sort_order=index,
            )
            for index, item in enumerate(new_authors or [])
        ]
        newPage.article_authors.set(items)
    if ("assignment_memo" in data):
        newPage.assignment_memo = data["assignment_memo"]
    if ("ethics_notes" in data):
        newPage.ethics_notes = data["ethics_notes"]

    section.add_child(instance=newPage)

    try: 
        newPage.save_revision()
    except ValidationError as err:
        newPage.delete()
        return HttpResponseBadRequest(err.messages) 
    

    return JsonResponse(newPage.get_latest_revision_as_object().to_json(), safe=False)

@login_required
def load_page(request, page_id):
    pageObject = get_object_or_404(ArticlePage, pk=page_id).specific.get_latest_revision_as_object()
    if (pageObject.live and pageObject.article_status != 6):
        print("Updating status for published article \"" + pageObject.title + "\"")
        pageObject.article_status = 6
        pageObject.save_revision(user=request.user)
    if ((not pageObject.live) and pageObject.article_status == 6):
        print("Updating status for unpublished article \"" + pageObject.title + "\"")
        pageObject.article_status = 5
        pageObject.save_revision(user=request.user)

    def hasDraftInDeadline(page):
        for deadline in page.deadline_list.all():
            if deadline.description == "Draft in":
                return True
        return False
    if (pageObject.deadline):
        print("Migrating deadline for " + pageObject.title)
        if (not hasDraftInDeadline(pageObject)):

            pageObject.deadline_list = list(pageObject.deadline_list.all()) + [
                ArticleDeadline(
                    description="Draft in",
                    date=pageObject.deadline,
                    completed=False
                )
            ]
        pageObject.deadline = None
        pageObject.save_revision(user=request.user)

    pageJson = pageObject.to_json()

    # Uses current collaborative page version (as not always saved to revision) if it exists (meaning someone is editing)
    collaboration = PageCollaboration.objects.filter(page_id=page_id).only("document").first()
    if collaboration and collaboration.document:
        document = Doc()
        document.apply_update(bytes(collaboration.document))
        authors = document.get("metadata", type=Map).get("articleAuthors")
        if isinstance(authors, Array):
            pageJson = json.loads(pageJson)
            pageJson["article_authors"] = [
                {"article_page": page_id, "author": item["authorId"], "author_role": item["role"]}
                for item in authors.to_py()
            ]
            pageJson = json.dumps(pageJson)
    return JsonResponse(pageJson, safe=False)

@login_required
def load_partial_pages(request, section="all", page=1):
    username = request.GET.get('username', '')
    include_published = request.GET.get('include_published', '')
    
    qs = ArticlePage.objects.all()
    if (section != "all"):
        qs = qs.child_of(get_object_or_404(SectionPage, slug=section.lower()))
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
        for currentPage in pages: 
            try: 
                currentPage = currentPage.latest_revision.content
            except:
                warnings.warn("Cannot get content for page " + str(currentPage.pk))
                print("Cannot get content for page " + str(currentPage.pk))
                continue 
            result += "{"
            result += "\"title\": \"" + currentPage.get("title").replace('"', '\\"') + "\", "
            result += "\"live\": " + str(currentPage.get("live")).lower() + ", "
            result += "\"pk\": " + str(currentPage.get("pk")) + ", "
            result += "\"assignment_folder\": \"" + (currentPage.get("assignment_folder") if currentPage.get("assignment_folder") else "") + "\", "
            result += "\"article_authors\": \"\", "
            result += "\"article_status\": " + str(currentPage.get("article_status") if currentPage.get("article_status") else 1) + ", "
            result += "\"category_page\": \"" + (str(currentPage.get("category_page")) if currentPage.get("category_page") else "")+ "\", "
            result += "\"deadline_list\": " + (str(currentPage.get("deadline_list")).replace("'", '"').replace("True", "true").replace("False", "false").replace("None", "null") if currentPage.get("deadline_list") else "[]")+ "},"

        result = result[:-1] + "]"
    return JsonResponse(result, safe=False)

@login_required
@require_POST
def update_content_tracker(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific.get_latest_revision_as_object()
    data = json.loads(request.body.decode('utf-8'))

    if ("title" in data):
        page.title = data["title"]
        if not page.live:
            page.slug = slugify(data["title"])
    if ("assignment_folder" in data):
        page.assignment_folder = data["assignment_folder"]
    if ("category" in data):
        if (page.get_primary_topic()): page.topics.remove(page.get_primary_topic().name)
        page.topics.add(data["category"])
        page.primary_tag_slug = slugify(data["category"])
        page.category_page = get_object_or_404(CategoryPage, title=data["category"])
    if ("current_section" in data):
        section = SectionPage.objects.get(id=data["current_section"])
        if (page.can_move_to(section)):
            page.move(section, pos='last-child')
            page.current_section = section.slug
        else:
            raise Exception("Page can't move to section")
    if ("article_status" in data):
        page.article_status = data["article_status"]
    if ("authors" in data):
        # Author role types not in assignment manager are saved first so they aren't overwritten
        page.article_authors.set(
            [
                ArticleAuthorsOrderable(
                    author=get_object_or_404(AuthorPage, id=item["author"]),
                    author_role=item["author_role"],
                    sort_order=index,
                )
                for index, item in enumerate(data["authors"] or [])
                if item["author_role"] in ASSIGNMENT_AUTHOR_ROLES
            ]
            +
            [
                item for item in page.article_authors.all()
                if item.author_role not in ASSIGNMENT_AUTHOR_ROLES
            ]
        )
    if ("assignment_memo" in data):
        page.assignment_memo = data["assignment_memo"]
    if ("ethics_notes" in data):
        page.ethics_notes = data["ethics_notes"]
    if ("deadline_list" in data):
        page.deadline_list = [
            ArticleDeadline(
                    description=deadline.get("description"),
                    date=deadline.get("date"),
                    completed=deadline.get("completed")
            )
            for index, deadline in enumerate(data["deadline_list"] or [])
        ]
        page.deadline_list.commit()

    page.save_revision(user=request.user, log_action=True, changed=False)
    update_page_collaboration(page, data)

    latest_revision = page.get_latest_revision_as_object()
    return JsonResponse(latest_revision.to_json(), safe=False)


@login_required
@require_POST
def page_collaboration(request, page_id):
    # Initalization before websockets kick in
    if not request.body or len(request.body) > 10 * 1024 * 1024:
        return HttpResponse(status=400)

    try:
        document = initialize_page_collaboration(page_id, request.body)
    except Page.DoesNotExist:
        return HttpResponse(status=404)

    return HttpResponse(document, content_type="application/octet-stream")


@login_required
def manuscript_editor(request, page_id):
    page = get_manuscript_page(page_id)
    editor_errors = {}
    page_form = create_page_form(page)
    article_authors_form = create_article_authors_form(page)
    featured_media_form = create_featured_media_form(page)

    if request.method == "POST":
        action = request.POST.get("action") or "draft"
        saved_revision = None
        editor_errors, page_form, article_authors_form, featured_media_form = process_submitted_page(page, request.POST)

        if not editor_errors:
            page, saved_revision, save_errors = save_page_revision(page, action, request.user)
            editor_errors.update(save_errors)

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
    article_media = get_object_or_404(Page, id=page_id).specific.article_media.all()
    last_saved_manuscript = PageCollaboration.objects.filter(page_id=page_id).only("updated_at").first()

    # self: contains information like page title, slug, etc, for form fields = for preview rendering
    # page_form: contains the form for the page fields
    # stream_editors: contains streamField names, block definitions, and preprocessed values
    # editor_errors: contains any errors from form submission
    # featured_media_form: contains the form for the featured media
    # article_media_upload_form: contains the form for uploading article media
    # article_media: contains the list of existing article images/documents in this page
    # last_saved_manuscript: sends last updated manuscript for saved info

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
    try:
        saved_revision = restore_page_revision(page, revision, request.POST, request.user)
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
    revision = None

    revision_id = request.POST.get("revision")
    if revision_id and revision_id != "current":
        revision = get_object_or_404(page.revisions, id=revision_id)

    page, editor_errors, page_form, article_authors_form, featured_media_form = prepare_preview(page, request.POST, revision)

    if editor_errors:
        return JsonResponse({"errors": editor_errors}, status=422)

    # Attempt to render the latest changes, if it throws an error, don't save
    try:
        html = render_to_string(
            "editors/preview/manuscript_preview.html",
            {"self": page, "page_form": page_form, "article_authors_form": article_authors_form, "featured_media_form": featured_media_form},
            request=request,
        )
    except Exception as error:
        warnings.warn(f"Failed to render manuscript preview for page {page_id}: {error}")
        return JsonResponse(
            {"errors": {"__all__": ["Failed to save. Undo your last change, contact webmaster if this isn't resolved."]}},
            status=422,
        )

    if revision is None:
        saved_revision = autosave_manuscript_revision(page.id, request.POST, request.user)
        if saved_revision is None:
            return JsonResponse({"errors": {"__all__": ["Failed to save."]}}, status=422)

    return JsonResponse({
        "errors": editor_errors,
        "html": html,
    })


@login_required
@require_POST
def manuscript_full_preview(request, page_id):
    page = get_manuscript_page(page_id)

    editor_errors, _, _, _ = process_submitted_page(
        page,
        request.POST,
    )
    if editor_errors:
        return JsonResponse({"errors": editor_errors}, status=400)

    # Attempt to render the latest changes, if it throws an error, cancel
    preview_response = page.make_preview_request(
        request,
        page.default_preview_mode,
    )
    if preview_response.status_code >= 500:
        warnings.warn(f"Failed to render manuscript preview for page {page_id}")
        return HttpResponse("Failed to save. Undo your last change, contact webmaster if this isn't resolved.", status=422)

    saved_revision = autosave_manuscript_revision(page.id, request.POST, request.user)
    if saved_revision is None:
        return HttpResponse("Failed to save. Please try again.", status=422)

    return preview_response


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
@require_GET
def manuscript_page_options(request, page_id):
    get_object_or_404(Page, id=page_id)
    query = request.GET.get("q", "").strip()[:100]
    selected_id = request.GET.get("selected")
    pages = Page.objects.type(ArticlePage)
    if query:
        pages = pages.filter(title__icontains=query)

    pages = pages.only("id", "title")
    pages = pages.order_by("title", "id") if query else pages.order_by("-id")
    options = [
        {"value": str(item.id), "label": item.title}
        for item in pages[:25]
    ]

    # Adds currently selected page
    if selected_id and not any(option["value"] == selected_id for option in options):
        selected = pages.filter(id=selected_id).first()
        if selected:
            options.insert(0, {"value": str(selected.id), "label": selected.title})

    return JsonResponse({"options": options})


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


#  Helpers - We should probably move these at some point

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
