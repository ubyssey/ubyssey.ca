from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import permission_required
from django.shortcuts import redirect, render
from django.utils import timezone

from wagtail.models import Site, Workflow, WorkflowState

from article.models import ArticlePage
from home.sports_calendar import import_calendar


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
