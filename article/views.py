import json
import time

from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils.text import slugify
from django.views.decorators.http import require_POST

from wagtail.admin.auth import user_passes_test
from wagtail.models import Page as WagtailPage, Site
from wagtail.admin.panels import FieldPanel, ObjectList, TabbedInterface
from wagtail.admin.ui.tables import UpdatedAtColumn
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from article.models import ArticleTopic, TipTapArticlePage

# ─── Admin URL constants ───────────────────────────────────────────────────────

ADMIN_PREFIX = '/admin/tiptap-editor/'
API_BASE = ADMIN_PREFIX + 'api/'


def _is_staff(user):
    return user.is_active and user.has_perm('wagtailadmin.access_admin')


def _get_json_body(request):
    try:
        return json.loads(request.body), None
    except json.JSONDecodeError:
        return None, JsonResponse({'error': 'Invalid JSON.'}, status=400)


# ─── Snippet viewset (unchanged) ──────────────────────────────────────────────

class ArticleTopicViewSet(SnippetViewSet):
    model = ArticleTopic
    icon = "pick"
    list_display = ["name", "recent_sections", "tagged_articles_count", "last_used_at", "listed", UpdatedAtColumn()]
    list_per_page = 50
    copy_view_enabled = False
    inspect_view_enabled = True
    search_fields = ["name"]
    ordering = "-last_used_at"

    list_export = ["name", "tagged_articles_count", "most_frequent_section", "last_used_at"]


# ─── TipTap article list ──────────────────────────────────────────────────────

@user_passes_test(_is_staff)
def tiptap_article_list_view(request):
    pages = TipTapArticlePage.objects.order_by('-last_published_at')
    return render(request, 'article/tiptap_article_list.html', {
        'pages': pages,
        'new_url': ADMIN_PREFIX + 'new/',
    })


# ─── Standalone Google-Docs editor ────────────────────────────────────────────

@user_passes_test(_is_staff)
def tiptap_admin_editor_view(request, page_id=None):
    page = None
    if page_id:
        page = get_object_or_404(TipTapArticlePage, id=page_id)

    return render(request, 'article/tiptap_standalone_editor.html', {
        'page_id': page.id if page else '',
        'title_json': json.dumps(page.title if page else ''),
        'lede_json': json.dumps(page.lede if page else ''),
        'body_json': json.dumps(page.body if page else {}),
        'view_url': page.full_url if (page and page.live) else '',
        'api_base': API_BASE,
        'list_url': ADMIN_PREFIX,
    })


# ─── Create / save / publish API ──────────────────────────────────────────────

@user_passes_test(_is_staff)
@require_POST
def tiptap_create_page(request):
    data, err = _get_json_body(request)
    if err:
        return err

    title = (data.get('title') or '').strip() or 'Untitled'
    unique_slug = f"{slugify(title) or 'untitled'}-{int(time.time())}"

    site = Site.objects.filter(is_default_site=True).first()
    parent = site.root_page if site else WagtailPage.objects.filter(depth=1).first()

    page = TipTapArticlePage(
        title=title,
        lede=data.get('lede', ''),
        body=data.get('body', {}),
        slug=unique_slug,
    )
    parent.add_child(instance=page)
    page.save_revision()

    return JsonResponse({
        'status': 'created',
        'page_id': page.id,
        'edit_url': f'{ADMIN_PREFIX}{page.id}/',
    })


@user_passes_test(_is_staff)
@require_POST
def save_tiptap_page(request, page_id):
    data, err = _get_json_body(request)
    if err:
        return err

    page = get_object_or_404(TipTapArticlePage, id=page_id)
    page.title = (data.get('title') or '').strip() or page.title
    page.lede = data.get('lede', page.lede)
    page.body = data.get('body', page.body)
    page.save_revision()

    return JsonResponse({'status': 'saved'})


@user_passes_test(_is_staff)
@require_POST
def publish_tiptap_page(request, page_id):
    data, err = _get_json_body(request)
    if err:
        return err

    page = get_object_or_404(TipTapArticlePage, id=page_id)
    page.title = (data.get('title') or '').strip() or page.title
    page.lede = data.get('lede', page.lede)
    page.body = data.get('body', page.body)
    page.save_revision().publish()
    page.refresh_from_db()

    return JsonResponse({'status': 'published', 'view_url': page.full_url})
