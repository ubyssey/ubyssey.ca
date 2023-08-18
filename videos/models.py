from django.db import models
from django.utils import timezone
from section.sectionable.models import SectionablePage # self made abstract model

from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator

from django_extensions.db.fields import AutoSlugField

from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel

from taggit.models import TaggedItemBase
from taggit.managers import TaggableManager

from ubyssey.validators import validate_youtube_url


from wagtail.admin.panels import TitleFieldPanel, FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.models import Orderable, Page
from wagtail.snippets.models import register_snippet
from wagtail.search import index


#-----Taggit stuff-----

class VideoTag(TaggedItemBase):
    content_object = ParentalKey('videos.VideoSnippet', on_delete=models.CASCADE, related_name='tagged_items')

#-----Orderable models-----

class VideoAuthorsOrderable(Orderable):
    """
    This closely corresponds to the Dispatch model that is (mis-)named "Author"
    """
    video = ParentalKey(
        "videos.VideoSnippet",
        related_name="video_authors",
    )
    author = models.ForeignKey(
        'authors.AuthorPage',
        on_delete=models.CASCADE,
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel("author"),
            ],
            heading="Author",
        ),
    ]

class VideosPage(SectionablePage):
    template = 'videos/videos_page.html'

    parent_page_types = [
        'home.HomePage',
    ]
    max_count_per_parent = 1
    show_in_menus_default = True
    
    def __str__(self):
        """String rep of VideosPage"""
        return self.title

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        all_videos = VideoSnippet.objects.all()

        paginator = Paginator(all_videos, per_page=15)

        page = request.GET.get("page")
        try:
            # If the page exists and the ?page=x is an int
            paginated_videos = paginator.page(page)
            
        except PageNotAnInteger:
            # If the ?page=x is not an int; show the first page
            paginated_videos = paginator.page(1)
        
        except EmptyPage:
            # If the ?page=x is out of range (too high most likely)
            # Then return the last page
            paginated_videos = paginator.page(paginator.num_pages)

        context["paginated_videos"] = paginated_videos
        
        return context
    
    # @route('^archive/videos$')


#-----Snippet models-----

@register_snippet
class VideoSnippet(index.Indexed, ClusterableModel):

    title = models.CharField(
        max_length=255,
        null=False,
        blank=False,
        default='',
    )
    slug = AutoSlugField(
        populate_from="title",
        editable=True,
        max_length=255,
        primary_key=True,
        unique=True,
        db_index=True,
        null=False,
        blank=False,
        default='',
    )
    url = models.URLField(
        max_length=500,
        null=False,
        blank=False,
        default='',
        validators=[validate_youtube_url,]
    )

    # v_authors = models.ManyToManyField(VideoAuthorsOrderable, related_name='video_authors')
    tags = TaggableManager(through=VideoTag, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def get_authors_string(self, authors_list=[]) -> str:
        """
        Returns html-friendly list of the VideoPage's authors as a comma-separated string (with 'and' before last author).
        Keeps large amounts of logic out of templates.
        """
        def format_author(video_author):
            return '<a href="%s">%s</a>' % (video_author.author.full_url, video_author.author.full_name)
            
            # if links:
            #     return '<a href="%s">%s</a>' % (self.video_authors.all()[0].author.full_url, self.video_authors.all()[0].author.full_name)
            # return self.video_authors.all()[0].author.full_name

        if not authors_list:
            authors = list(map(format_author, self.video_authors.all()))
        else:
            authors = list(map(format_author, authors_list))

        if not authors:
            return ""
        elif len(authors) == 1:
            # If this is the only author, just return author name
            return authors[0]

        return ", ".join(authors[0:-1]) + " and " + authors[-1]        
    authors_string = property(fget=get_authors_string)

    def get_authors_with_urls(self) -> str:
        """
        Wrapper for get_authors_string for easy use in templates.
        """
        return self.get_authors_string(links=True)
    authors_with_urls = property(fget=get_authors_with_urls)

    panels = [
        MultiFieldPanel(
            [
                TitleFieldPanel("title"), 
                FieldPanel("slug"),
                FieldPanel("url"),
            ],
            heading="Necessary Fields"
        ),
        MultiFieldPanel(
            [
                InlinePanel("video_authors", max_num=20, label="Author"),
            ],
            heading="Author(s)"
        ),
        MultiFieldPanel(
            [
                FieldPanel("tags"), 
            ],
            heading="Tags"
        ),
    ]
        #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = [
        index.SearchField('title'),
        index.SearchField('slug'),
        
        index.FilterField('video_authors'),
        index.FilterField('tags'),
        index.FilterField('slug'),
        index.FilterField('created_at'),
    ]
    class Meta:
        verbose_name = "Video"
        verbose_name_plural = "Videos"
        ordering = ['-created_at']