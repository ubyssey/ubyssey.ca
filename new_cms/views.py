import json

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from wagtail.fields import StreamField as WagtailStreamField
from wagtail.models import Page

from article.models import StandardArticlePage
from section.models import SectionPage

from wagtail.telepath import JSContext


# Helper
def get_streamfields(page):
    streamfield_blocks = {}
    packed_blocks = {}
    js_context = JSContext()
    for field in page._meta.get_fields():
        if not isinstance(field, WagtailStreamField):
            continue
        value = getattr(page, field.name)
        if value is None:
            streamfield_blocks[field.name] = "[]"
            continue
        try:
            raw = field.stream_block.get_prep_value(value)
            streamfield_blocks[field.name] = json.dumps(raw, indent=2, default=str)
        except Exception:
            streamfield_blocks[field.name] = "[]"
            print("Failed to get field: " + field.name)
        try: 
            packed_blocks[field.name] = js_context.pack(field.stream_block)
        except Exception:
            packed_blocks[field.name] = None
            print("Failed to pack block: " + field.name)
    return streamfield_blocks, packed_blocks, js_context.media


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

    stream_data, packed_blocks, telepath_media = get_streamfields(page)

    return render(
        request, "manuscript_editor.html", 
        {"page": page, 
         "stream_data": stream_data, 
         "packed_blocks": packed_blocks,
         "telepath_media": telepath_media}
    )

@login_required
def homepage_editor(request):
    return render(request, "homepage_editor.html")