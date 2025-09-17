from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from wagtail.models import Site, TaskState, Workflow, WorkflowState

from article.models import ArticlePage

class ArticleHomePageCuratedSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    url = serializers.URLField(source="get_url")
    datetime = serializers.DateTimeField(source="first_published_at")
    live = serializers.BooleanField()
    timeliness = serializers.IntegerField()

    class Meta:
        model = ArticlePage
        fields = ('id', 'title', 'url', 'datetime', 'live', 'timeliness')

class ArticleHomePageReadySerializer(serializers.ModelSerializer):
    article = serializers.SerializerMethodField()
    ready_at = serializers.DateTimeField(source="created_at")

    def get_article(self, obj):
        article = ArticlePage.objects.get(id=obj.content_object.id)
        return ArticleHomePageCuratedSerializer(article, many=False).data

    class Meta:
        model = WorkflowState
        fields = ('article', 'ready_at')

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def homepage_curated_api(request):
    """
    List all code snippets, or create a new snippet.
    """

    if request.method == 'GET':
        site =  Site.find_for_request(request)

        articleIDs = site.root_page.specific.get_curated_articles()
        articles = ArticlePage.objects.filter(id__in=articleIDs)

        articles_serialized = ArticleHomePageCuratedSerializer(articles, many=True)

        return Response({
            "articles": articles_serialized.data,
            })
    
@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def publish_committee_workflow_api(request):
    """
    List all code snippets, or create a new snippet.
    """

    if request.method == 'GET':
        workflow = Workflow.objects.filter(name="Cabinet").first()

        workflow_states = []
        if workflow != None:
            workflow_states = workflow.workflow_states.filter(status="in_progress")

        print(workflow_states)

        articles_serialized = ArticleHomePageReadySerializer(workflow_states, many=True)
    
        return Response({
            "workflows": articles_serialized.data,
            })
    
@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def articlepage_drafts_api(request, id):
    """
    List all code snippets, or create a new snippet.
    """

    if request.method == 'GET':
        article = ArticlePage.objects.filter(id=id).first()

        if article != None:
            article_serialized = ArticleHomePageCuratedSerializer(article, many=False)
        
            return Response(article_serialized.data)
        
        return Response(status=404)