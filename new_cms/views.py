import json

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from wagtail.fields import StreamField as WagtailStreamField
from wagtail.models import Page

from article.models import StandardArticlePage
from section.models import SectionPage


# Helper
def get_streamfields(page):
    result = {}
    for field in page._meta.get_fields():
        if not isinstance(field, WagtailStreamField):
            continue
        value = getattr(page, field.name)
        if value is None:
            result[field.name] = "[]"
            continue
        try:
            raw = field.stream_block.get_prep_value(value)
            result[field.name] = json.dumps(raw, indent=2, default=str)
        except Exception:
            result[field.name] = "[]"
            print("Failed to get field: " + field.name)
    return result


@login_required
def index(request):
    qs = Page.objects.all().order_by("-last_published_at", "-pk")

    paginator = Paginator(qs, 50)
    pages = paginator.get_page(request.GET.get("page", 1))

    return render(request, "index.html", {"pages": pages})


@login_required
def manuscript_editor(request, page_id):
    page = get_object_or_404(Page, id=page_id).specific

    if request.method == "POST":
        page.title = request.POST.get("title", page.title).strip()
        page.slug = request.POST.get("slug", page.title).strip()
        page.lede = request.POST.get("lede", page.lede).strip()

        for field in page._meta.get_fields():
            if not isinstance(field, WagtailStreamField):
                continue
            json_str = request.POST.get(f"stream_{field.name}", "").strip()
            if not json_str:
                continue
            try:
                setattr(page, field.name, json.loads(json_str))
            except:
                print("Failed to edit field:" + field.name)

    try:
        revision = page.save_revision(user=request.user)
        if request.POST.get("action") == "publish":
            revision.publish(user=request.user)
            print("Revised page")
        else:
            print("Draft Saved")
    except:
        print("Failed to update page:" + page.title)

    stream_data = get_streamfields(page)
    return render(
        request, "manuscript_editor.html", {"page": page, "stream_data": stream_data}
    )

@login_required
def homepage_editor(request):
    return render(request, "homepage_editor.html")