import json

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, render
from django.core.exceptions import ValidationError
from wagtail.fields import StreamField as WagtailStreamField
from wagtail.models import Page

from new_cms.editor import get_featured_media_form, get_page_form, get_streamfields, save_featured_media_form


@login_required
def index(request):
    qs = Page.objects.all().order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("page", 1))

    return render(request, "index.html", {"pages": pages})


@login_required
def manuscript_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific
    editor_errors = {}

    page_form = get_page_form(page, request.POST if request.method == "POST" else None)
    featured_media_form = get_featured_media_form(page, request.POST if request.method == "POST" else None)

    if request.method == "POST":
        if page_form.is_valid():
            for field_name, value in page_form.cleaned_data.items():
                setattr(page, field_name, value)
        else:
            for field_name, field_errors in page_form.errors.items():
                editor_errors[field_name] = list(field_errors)

        if featured_media_form:
            if featured_media_form.is_valid():
                save_featured_media_form(page, featured_media_form)
            else:
                for field_name, field_errors in featured_media_form.errors.items():
                    editor_errors[f"featured_media.{field_name}"] = list(field_errors)

        for field in page._meta.get_fields():
            if not isinstance(field, WagtailStreamField):
                continue
            json_str = request.POST.get(f"stream_{field.name}", "").strip()
            if not json_str:
                continue
            try:
                setattr(page, field.name, json.loads(json_str))
            except:
                editor_errors[field.name] = ["Invalid JSON for this field."]

        if not editor_errors:
            siblings = page.get_siblings().exclude(id=page.id)
            if siblings.filter(slug=page.slug).exists():
                editor_errors["slug"] = ["Slug must be unique among siblings."]
            else:
                try:
                    page.full_clean()
                except ValidationError as e:
                    for field, field_errors in e.message_dict.items():
                        if field in editor_errors:
                            editor_errors[field].extend(field_errors)
                        else:
                            editor_errors[field] = field_errors
                else:
                    try:
                        revision = page.save_revision(user=request.user)
                        if request.POST.get("action") == "publish":
                            revision.publish(user=request.user)
                            print("Revised page")
                        else:
                            print("Draft Saved")
                    except:
                        print("Failed to update page:" + page.title)

    if (editor_errors):
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
def homepage_editor(request):
    return render(request, "homepage_editor.html")
