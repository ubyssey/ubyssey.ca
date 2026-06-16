import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.views.decorators.http import require_POST
from wagtail.documents import get_document_model
from wagtail.fields import StreamField as WagtailStreamField
from wagtail.models import Page
from wagtail.admin.views.pages.history import PageHistoryView

from new_cms.editor import (
    get_article_media_choices,
    get_article_media_upload_form,
    get_featured_media_form,
    get_page_form,
    get_streamfields,
    save_article_media_upload,
    save_featured_media_form,
)


@login_required
def index(request):
    editable_pages = ["authorpage", "homepage", "standardarticlepage", "liveblogarticlepage", "sectionpage"]
    qs = Page.objects.filter(content_type__model__in=editable_pages).order_by("-last_published_at", "-pk")
    #qs = Page.objects.all().order_by("-last_published_at", "-pk")
    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("page", 1))

    return render(request, "index.html", {"pages": pages})


@login_required
def manuscript_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    editor_errors = {}
    page_form = get_page_form(page)
    featured_media_form = get_featured_media_form(page)

    # History
    history = []
    for revision in page.revisions.all().order_by("-created_at"):
        history.append({"id" : str(revision.id), "user" : str(revision.user), "created_at" : str(revision.created_at) })

    if request.method == "POST":
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
                        revision = page.save_revision(user=request.user)
                        if request.POST.get("action") == "publish":
                            revision.publish(user=request.user)
                            print("Revised page")
                        else:
                            print("Draft Saved")
                    except Exception:
                        print("Failed to update page:" + page.title)

    if editor_errors:
        print(f"Validation Error: {editor_errors}")

    stream_data, block_registry, editor_data = get_streamfields(page)
    article_media = page.article_media.all()

    # self: contains information like page title, slug, etc, for form fields = for preview rendering 
    # page_form: contains the form for the page fields
    # featured_media_form: contains the form for the featured media
    # article_media_upload_form: contains the form for uploading article media
    # article_media: contains the list of existing article images/documents in this page
    # article_media_choices: contains options for media selection dropdowns
    # stream_data: contains information within blocks ie the text inside a RichTextBlock, this is mostly for saving which is why we have both stream_data and editor_data
    # block_registry: contains the field types/options for each block
    # editor_data: same as stream_data but in a preprocessed format (was originally processed on the JS side, but moved here to clean up the JS, maybe worth switching back?)
    # editor_errors: contains any errors from form submission

    return render(
        request, "editors/manuscript_editor.html",
        {"self": page,
         "page_form": page_form,
         "featured_media_form": featured_media_form,
         "article_media_upload_form": get_article_media_upload_form(),
         "article_media": article_media,
         "article_media_choices": get_article_media_choices(article_media),
         "stream_data": stream_data,
         "block_registry": block_registry,
         "editor_data": editor_data,
         "editor_errors": editor_errors,
         "history" : history}
    )


@login_required
@require_POST
def manuscript_preview(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
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
        "gallery": render_to_string("editors/components/article_media_gallery.html", {"article_media": article_media}, request=request),
        "choices": get_article_media_choices(article_media),
    })


def apply_editor_post(page, data, preview=False):
    editor_errors = {}
    page_form = get_page_form(page, data)
    featured_media_form = get_featured_media_form(page, data)
    if page_form.is_valid():
        for field_name, value in page_form.cleaned_data.items():
            setattr(page, field_name, value)
    else:
        add_form_errors(editor_errors, page_form)

    if featured_media_form:
        if featured_media_form.is_valid():
            save_featured_media_form(page, featured_media_form)
        else:
            add_form_errors(editor_errors, featured_media_form, "featured_media")

    for field in page._meta.get_fields():
        if not isinstance(field, WagtailStreamField):
            continue
        json_str = data.get(f"stream_{field.name}", "").strip()
        if not json_str:
            continue
        try:
            value = json.loads(json_str)
            if preview:
                value = sanitize_preview_stream_value(value)
            setattr(page, field.name, value)
        except json.JSONDecodeError:
            editor_errors[field.name] = ["Invalid JSON for this field."]

    return editor_errors, page_form, featured_media_form


def sanitize_preview_stream_value(value):
    if isinstance(value, list):
        items = []
        for item in value:
            sanitized_item = sanitize_preview_stream_value(item)
            if sanitized_item is not None or not (isinstance(item, dict) and item.get("type") == "audio"):
                items.append(sanitized_item)
        return items

    if isinstance(value, dict) and value.get("type") == "audio":
        block_value = value.get("value")
        if not isinstance(block_value, dict) or not block_value:
            return None

        audio_id = block_value.get("audio")
        nested_block = block_value.get("block")
        if audio_id is None and isinstance(nested_block, dict):
            audio_id = nested_block.get("audio")

        if not audio_id:
            return None

        try:
            audio_id = int(audio_id)
        except (TypeError, ValueError):
            return None

        if not get_document_model().objects.filter(id=audio_id).exists():
            return None

    if isinstance(value, dict):
        return {key: sanitize_preview_stream_value(item) for key, item in value.items()}

    return value


def add_form_errors(editor_errors, form, prefix=None):
    for field_name, field_errors in form.errors.items():
        key = f"{prefix}.{field_name}" if prefix else field_name
        editor_errors[key] = list(field_errors)


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