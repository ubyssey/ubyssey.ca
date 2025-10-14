from django.shortcuts import render
from django.utils import timezone
from wagtail.admin.viewsets.chooser import ChooserViewSet



from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from article.models import ArticlePage
from content_tracker.models import StoryAssignment, VisualAssignment
from home.views import ArticleHomePageCuratedSerializer 

story_assignment_chooser_viewset = ChooserViewSet("story_assignment_chooser")


class StoryAssignmentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()
    subject = serializers.CharField()
    story_type = serializers.CharField()
    assigning_section = serializers.CharField()
    summary = serializers.CharField()

    article_file_folder = serializers.URLField()
    manuscript = serializers.URLField()

    created = serializers.DateTimeField()
    deadline = serializers.DateField()
    target = serializers.DateField()

    state = serializers.CharField()

    article_page = ArticleHomePageCuratedSerializer(many=False)

    class Meta:
        model = StoryAssignment
        fields = ('id', 'subject', 'story_type', 'assigning_section', 'summary', 'article_file_folder', 
                  'manuscript', 'created', 'deadline', 'target', 'state', 'article_page')


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def story_assignment_api_list(request):
    """
    List all code snippets, or create a new snippet.
    """

    if request.method == 'GET':
        assignment = StoryAssignment.objects.all()

        timeCursor = 0

        if 'timeCursor' in request.query_params:
            timeCursor = int(request.query_params['timeCursor'])
            print(f"time cursor: {timeCursor}")
            upperBound = timezone.datetime.now() + (timeCursor * timezone.timedelta(days=7))
            assignment = assignment.filter(target__lte=upperBound)

        if 'timeScale' in request.query_params:
            timeScale = int(request.query_params['timeScale'])
            print(f"time scale: {timeScale}")
            lowerBound = timezone.datetime.now() - (timeScale * timezone.timedelta(days=7)) + (timeCursor * timezone.timedelta(days=7))
            assignment = assignment.filter(target__gte=lowerBound)

        if assignment != None:
            assignment_serialized = StoryAssignmentSerializer(assignment.order_by("-target")[:1000], many=True)
        
            return Response(assignment_serialized.data)
        
        return Response(status=404)