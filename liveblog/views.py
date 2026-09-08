from types import SimpleNamespace

from django.http import Http404
from django.shortcuts import render
from django.template.loader import render_to_string

# Create your views here.

from django.http import HttpResponse
from django.utils import timezone

from liveblog.models import LiveBlogArticlePage

def liveblog_admin(request, id):
    page = LiveBlogArticlePage.objects.filter(id=id).first()

    if page == None:
        return render(request, '404.html', {}, status=404)

    return render(request, "liveblog/liveblog_admin_page.html", page.get_admin_context(request))


def redesign_preview(request, state):
    """Local-only fixture exercising the production liveblog React renderer."""
    if state not in {"live", "concluded"}:
        raise Http404

    article = SimpleNamespace(
        redesign_header_layout="big-centered",
        full_bleed_nav_color="white",
        title="AMS Council extends Friendlier pilot, takes stance on academic freedom",
    )
    nav_html = render_to_string(
        "article/components/redesign_nav.html",
        {"article": article, "request": request},
    )
    summary_image = "/redesign-sample/section-news/media/10-in-turnaround-ams-council-approves-pit-renovation-thumbnail-1133c01f.webp"
    page_info = {
        "meta": {
            "title": article.title,
            "lede": "Council has approved the AMS's finalized budget — largely unchanged from the preliminary — and an extension of the Friendlier pilot program.",
            "authors": "By <strong>MANELI MOGHBELI</strong>, <strong>THEA LEE</strong>, <strong>STEPHEN KOSAR</strong> and <strong>SPENCER IZEN</strong>",
            "layout": "default",
            "live_policy": "manual-live" if state == "live" else "manual-not-live",
        },
        "stage": [
            {"type": "header", "value": None},
            {"type": "summary", "value": {"richtext": (
                f'<img src="{summary_image}" alt="AMS Council meets in the Nest council chamber.">'
                '<p class="caption">AMS Council during a previous meeting. Aleah Kippan / The Ubyssey</p>'
                '<h2>Here’s the latest</h2>'
                '<ul><li>Council approved the finalized 2026/27 budget.</li>'
                '<li>The Friendlier reusable-container pilot was extended.</li>'
                '<li>Councillors adopted a motion concerning academic freedom.</li></ul>'
            )}},
        ],
    }
    portrait_root = "/redesign-sample/our-team/media/"
    portraits = {
        "maneli": portrait_root + "person-10-maneli-moghbeli-043bbeeb.png",
        "juan": portrait_root + "person-06-juan-pablo-sastoque-vega-27b450c3.jpg",
        "spencer": portrait_root + "person-02-spencer-izen-364aff5a.jpg",
        "stephen": portrait_root + "person-07-stephen-kosar-ba1084a1.jpg",
    }

    def author(name, role, path, portrait=None):
        image = None
        if portrait:
            image = f'<img src="{portrait}" alt="Portrait of {name}">'
        return {
            "author_image": image,
            "author_link": path,
            "author_name": name,
            "author_role": role,
        }

    authors = [author("Maneli Moghbeli", "News Staff", "/authors/maneli-moghbeli/")]
    updates = [
        {
            "id": 301,
            "publish_date": "2026-09-02T19:12:00-07:00",
            "authors": authors,
            "html": "<h2>Council extends Friendlier pilot</h2><p>Council approved an extension of the Friendlier reusable-container pilot after discussing its performance across AMS food and beverage outlets.</p><p>The extension keeps the program in place while staff collect more information about return rates and customer use.</p>",
        },
        {
            "id": 302,
            "publish_date": "2026-09-02T20:03:00-07:00",
            "authors": [author("Juan Pablo Sastoque Vega", "News Editor", "/authors/juan-pablo-sastoque-vega/", portraits["juan"])],
            "html": (
                "<h2>Finalized budget passes</h2>"
                "<p>Councillors approved the AMS’s finalized budget. The document remains largely unchanged from the preliminary version considered earlier in the year.</p>"
                "<figure class=\"liveblog-media\"><img src=\"/redesign-sample/section-news/media/10-in-turnaround-ams-council-approves-pit-renovation-thumbnail-1133c01f.webp\" alt=\"Council chamber during an AMS Council meeting.\"><figcaption>AMS Council during a previous meeting. Aleah Kippan / The Ubyssey</figcaption></figure>"
            ),
        },
        {
            "id": 303,
            "publish_date": "2026-09-02T21:18:00-07:00",
            "authors": [
                author("Spencer Izen", "Managing Editor", "/authors/spencer-izen/", portraits["spencer"]),
                author("Stephen Kosar", "Deputy News Editor", "/authors/stephen-kosar/", portraits["stephen"]),
            ],
            "html": "<h2>Academic freedom motion adopted</h2><p>After debate, Council adopted a motion setting out its position on academic freedom and the student union’s role in responding to campus concerns.</p>",
        },
        {
            "id": 304,
            "publish_date": "2026-09-02T21:42:00-07:00",
            "authors": [author("Maneli Moghbeli", "News Staff", "/authors/maneli-moghbeli/", portraits["maneli"])],
            "html": (
                "<h2>Council discussion continues</h2>"
                "<p>Watch a previous Council discussion to see the format used for public delegations and debate.</p>"
                "<div class=\"liveblog-video\"><iframe src=\"https://www.youtube.com/embed/H1EvG7Fvr1o?rel=0\" title=\"The Ubyssey video\" loading=\"lazy\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe></div>"
            ),
        },
    ]
    return render(request, "liveblog/redesign_preview.html", {
        "room_name": f"preview-{state}",
        "update_order": "desc" if state == "live" else "asc",
        "updates": updates,
        "page_info": page_info,
        "nav_html": nav_html,
        "suggested_html": render_to_string("liveblog/redesign_suggested_preview.html", request=request),
        "admin_view": False,
        "is_admin": False,
        "preview_mode": True,
        "is_preview_live": state == "live",
        "meta": {"title": f"Live updates redesign — {state}", "description": "Local live updates redesign preview", "noindex": True},
    })
