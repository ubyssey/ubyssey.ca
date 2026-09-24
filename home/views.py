from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import permission_required
from django.core.cache import cache
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from wagtail.models import Site, Workflow, WorkflowState

from article.models import ArticlePage
from home.game_analysis_queries import (
    chronological_articles,
    fixture_queues,
    panel_active_sports,
)
from home.models import HomePage
from home.sports_calendar import import_calendar


@require_GET
@never_cache
def game_analysis_filter(request):
    """Load only the stories and fixtures for the chosen active sports."""
    site = Site.find_for_request(request)
    home = HomePage.objects.live().public().filter(pk=site.root_page_id).first() if site else None
    if home is None:
        return JsonResponse({"error": "Homepage unavailable."}, status=404)

    panel = next((item.value for item in home.game_analysis if item.block_type == "panel"), None)
    active_sports = panel_active_sports(panel)
    requested = request.GET.getlist("sport")
    if not requested or len(requested) > len(active_sports) or len(set(requested)) != len(requested):
        return HttpResponseBadRequest("Select one or more active sports.")
    if any(sport not in active_sports for sport in requested):
        return HttpResponseBadRequest("Unknown or inactive sport.")
    sports = [sport for sport in active_sports if sport in requested]
    cache_key = f"game-analysis-filter:v1:{home.pk}:{','.join(sports)}"
    result = cache.get(cache_key)
    if result is None:
        articles = chronological_articles(sports)
        upcoming, recent = fixture_queues(sports, timezone.now())
        result = {
            "stories": "".join(
                render_to_string(
                    "home/components/game_analysis_story.html",
                    {"item": {"article": article, "sport": article.covered_sport}, "position": index},
                    request=request,
                )
                for index, article in enumerate(articles, start=1)
            ),
            "upcoming": "".join(
                render_to_string(
                    "home/components/redesign_fixture.html", {"game": game}, request=request
                )
                for game in upcoming
            ),
            "recent": "".join(
                render_to_string(
                    "home/components/redesign_fixture.html", {"game": game, "recent": True}, request=request
                )
                for game in recent
            ),
        }
        cache.set(cache_key, result, timeout=60)
    return JsonResponse(result)


class ArticleHomePageCuratedSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    current_section = serializers.CharField()
    url = serializers.URLField(source="get_url")
    datetime = serializers.DateTimeField(source="first_published_at")
    live = serializers.BooleanField()
    timeliness = serializers.IntegerField()
    image = serializers.URLField(source="get_featured_media_image_url")

    class Meta:
        model = ArticlePage
        fields = ("id", "title", "current_section", "url", "datetime", "live", "timeliness", "image")


class ArticleHomePageReadySerializer(serializers.ModelSerializer):
    article = serializers.SerializerMethodField()
    ready_at = serializers.DateTimeField(source="created_at")

    def get_article(self, obj):
        article = ArticlePage.objects.get(id=obj.content_object.id)
        return ArticleHomePageCuratedSerializer(article, many=False).data

    class Meta:
        model = WorkflowState
        fields = ("article", "ready_at")


@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def homepage_curated_api(request):
    site = Site.find_for_request(request)
    article_ids = site.root_page.specific.get_curated_articles()
    articles = ArticlePage.objects.filter(id__in=article_ids)
    return Response({"articles": ArticleHomePageCuratedSerializer(articles, many=True).data})


@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def publish_committee_workflow_api(request):
    workflow = Workflow.objects.filter(name="Cabinet").first()
    workflow_states = workflow.workflow_states.filter(status="in_progress") if workflow else []
    return Response({"workflows": ArticleHomePageReadySerializer(workflow_states, many=True).data})


@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def articlepage_drafts_api_list(request):
    articles = ArticlePage.objects.all()
    time_cursor = int(request.query_params.get("timeCursor", 0))
    if "timeCursor" in request.query_params:
        upper_bound = timezone.datetime.now() + (time_cursor * timezone.timedelta(days=7))
        articles = articles.filter(first_published_at__lte=upper_bound)
    if "timeScale" in request.query_params:
        time_scale = int(request.query_params["timeScale"])
        lower_bound = timezone.datetime.now() - (time_scale * timezone.timedelta(days=7)) + (time_cursor * timezone.timedelta(days=7))
        articles = articles.filter(first_published_at__gte=lower_bound)
    return Response(ArticleHomePageCuratedSerializer(articles.order_by("-first_published_at")[:1000], many=True).data)


@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def articlepage_drafts_api(request, id):
    article = ArticlePage.objects.filter(id=id).first()
    if article is None:
        return Response(status=404)
    return Response(ArticleHomePageCuratedSerializer(article, many=False).data)


class ThunderbirdCalendarUploadForm(forms.Form):
    calendar = forms.FileField(
        label="Thunderbirds calendar CSV",
        help_text="Upload the latest downloaded schedule CSV. Existing scores are kept.",
    )

    def clean_calendar(self):
        calendar = self.cleaned_data["calendar"]
        if not calendar.name.lower().endswith(".csv"):
            raise forms.ValidationError("Please upload a CSV file.")
        return calendar


@permission_required("home.change_thunderbirdfixture", raise_exception=True)
def sports_calendar_import(request):
    form = ThunderbirdCalendarUploadForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        try:
            result = import_calendar(form.cleaned_data["calendar"])
        except UnicodeDecodeError:
            form.add_error("calendar", "The file must be UTF-8 encoded CSV exported from the Thunderbird schedule.")
        else:
            messages.success(
                request,
                f"Imported or refreshed {result['imported']} covered fixtures. "
                f"{result['reconciled']} rescheduled fixture(s) kept their existing scores. "
                f"{result['skipped']} incomplete rows were skipped; existing scores were preserved.",
            )
            return redirect("sports-calendar-import")
    return render(request, "home/admin/sports_calendar_import.html", {"form": form})
