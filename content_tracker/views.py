from django.shortcuts import render
from django.utils import timezone
from django.db.models import Q
from wagtail.admin.viewsets.chooser import ChooserViewSet



from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from authors.models import AuthorPage
from article.models import ArticlePage
from content_tracker.models import StoryAssignment, VisualAssignment
from home.views import ArticleHomePageCuratedSerializer 

story_assignment_chooser_viewset = ChooserViewSet("story_assignment_chooser")

class AssigneeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField(source="assignee.full_name")
    slug = serializers.CharField(source="assignee.slug")
    image = serializers.URLField(source="assignee.get_image_url")

    class Meta:
        model = AuthorPage
        fields = ('id', 'full_name', 'slug', 'image')

class VisualAssignmentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()

    memo  = serializers.URLField()
    request = serializers.CharField()
    visual_type = serializers.CharField()

    created = serializers.DateTimeField()
    deadline = serializers.DateField()

    state = serializers.CharField()

    assignees = AssigneeSerializer(source="visual_assignees", many=True)

    class Meta:
        model = VisualAssignment
        fields = ('id', 'memo', 'request', 'visual_type', 'created', 'deadline', 'state', 'assignees')


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

    state = serializers.IntegerField()

    article_page = ArticleHomePageCuratedSerializer(many=False)

    assignees = AssigneeSerializer(source="story_assignees", many=True)

    class Meta:
        model = StoryAssignment
        fields = ('id', 'subject', 'story_type', 'assigning_section', 'summary', 'article_file_folder', 
                  'manuscript', 'created', 'deadline', 'target', 'state', 'article_page', 'assignees')

class VisualAssignmentWithStoryAssignmentSerializer(VisualAssignmentSerializer):
    story_assignment = StoryAssignmentSerializer(many=False)

    class Meta:
        model = VisualAssignment
        fields = ('id', 'memo', 'request', 'visual_type', 'created', 'deadline', 'state', 'assignees', 'story_assignment')


class StoryAssignmentWithVisualRequestsSerializer(StoryAssignmentSerializer):
    visual_requests = VisualAssignmentSerializer(many=True)

    class Meta:
        model = StoryAssignment
        fields = ('id', 'subject', 'story_type', 'assigning_section', 'summary', 'article_file_folder', 
                  'manuscript', 'created', 'deadline', 'target', 'state', 'article_page', 'assignees', 'visual_requests',)


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

        if 'active' in request.query_params:
            assignment = assignment.exclude(state=StoryAssignment.StateChoices.PUBLISHED)

        if 'late' in request.query_params:
            assignment = assignment.filter(target__lte=timezone.now()).exclude(state=StoryAssignment.StateChoices.PUBLISHED)

        if 'timeCursor' in request.query_params:
            timeCursor = int(request.query_params['timeCursor'])
            upperBound = timezone.datetime.now() + (timeCursor * timezone.timedelta(days=7))
            assignment = assignment.filter(target__lte=upperBound)

        if 'timeScale' in request.query_params:
            timeScale = int(request.query_params['timeScale'])
            lowerBound = timezone.datetime.now() - (timeScale * timezone.timedelta(days=7)) + (timeCursor * timezone.timedelta(days=7))
            assignment = assignment.filter(target__gte=lowerBound)

        if assignment != None:

            if 'orderby' in request.query_params:
                assignment_serialized = StoryAssignmentWithVisualRequestsSerializer(assignment.order_by(request.query_params['orderby'])[:1000], many=True)                    

                return Response(assignment_serialized.data)

            assignment_serialized = StoryAssignmentWithVisualRequestsSerializer(assignment.order_by("-target")[:1000], many=True)
        
            return Response(assignment_serialized.data)
        
        return Response(status=404)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def visual_assignment_api_list(request):
    """
    List all code snippets, or create a new snippet.
    """

    if request.method == 'GET':
        assignment = VisualAssignment.objects.all()

        if 'active' in request.query_params:
            assignment = assignment.exclude(state=VisualAssignment.StateChoices.COMPLETED)

        if assignment != None:

            if 'orderby' in request.query_params:
                assignment_serialized = VisualAssignmentWithStoryAssignmentSerializer(assignment.order_by(request.query_params['orderby'])[:1000], many=True)                    

                return Response(assignment_serialized.data)

            assignment_serialized = VisualAssignmentWithStoryAssignmentSerializer(assignment.order_by("-created")[:1000], many=True)
        
            return Response(assignment_serialized.data)
        
        return Response(status=404)