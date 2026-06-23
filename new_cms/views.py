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
from article.models import ArticlePage

from new_cms.editor import get_featured_media_form, get_page_form, get_streamfields, save_featured_media_form


@login_required
def index(request):
    qs = ArticlePage.objects.all().order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("article-page", 1))
    print(pages)
    print(dir(pages[0]))
    print(pages[10].get_authors_in_order().pop().author)
    # print(pages[11].authors)

    return render(request, "index.html", {"pages": pages})


@login_required
def manuscript_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    editor_errors = {}
    page_form = get_page_form(page)
    featured_media_form = get_featured_media_form(page)

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

    return render(
        request, "manuscript_editor.html",
        {"self": page,
         "page_form": page_form,
         "featured_media_form": featured_media_form,
         "stream_data": stream_data,
         "block_registry": block_registry,
         "editor_data": editor_data,
         "editor_errors": editor_errors}
    )


@login_required
@require_POST
def manuscript_preview(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    editor_errors, page_form, featured_media_form = apply_editor_post(page, request.POST, preview=True)

    if editor_errors:
        return JsonResponse({"errors": editor_errors}, status=400)

    return JsonResponse({
        "html": render_to_string(
            "preview/manuscript_article_preview.html",
            {"self": page, "page_form": page_form, "featured_media_form": featured_media_form},
            request=request,
        )
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
def homepage_editor(request):
    return render(request, "homepage_editor.html")
