from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage , CategorySnippet
from django.db import models
from django.utils import timezone

from ads.models import AdSlot
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.models import Page, Orderable
from wagtail.fields import StreamField
from modelcluster.fields import ParentalKey
from infinitefeed import blocks as infinitefeedblocks

# Create your models here.

class TopArticlesOrderable(Orderable):
    home_page = ParentalKey(
        "home.HomePage",
        related_name="top_articles",
    )
    article = models.ForeignKey(
        'article.ArticlePage',
        on_delete=models.CASCADE,
        related_name="top_articles",
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel('article'),
            ],
            heading="Article"
        ),
    ]

class HomePage(Page):
    show_in_menus_default = True
    template = "home/home_page.html"
    
    parent_page_types = [
        'wagtailcore.Page',
    ]

    subpage_types = [
        'section.SectionPage',
        'authors.AllAuthorsPage',
        'videos.VideosPage',
        'archive.ArchivePage',
    ]

    tagline = models.CharField(
        blank=True,
        null=True,
        max_length=50)
    
    tagline_url = models.URLField(
        blank=True,
        null=True
    )

    cover_story = ParentalKey(
        "wagtailcore.Page",
        related_name = "home_cover_story",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    middle_stream = StreamField(
        [
            ("links", homeblocks.LinksStreamBlock()),
            ('section', homeblocks.SectionBlock())
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    sections_stream = StreamField(
        [
            ("home_page_section_block", homeblocks.HomepageFeaturedSectionBlock())
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    sidebar_stream = StreamField(
    [
        ("sidebar_advertisement_block", infinitefeedblocks.SidebarAdvertisementBlock()),
        ("sidebar_issues_block", infinitefeedblocks.SidebarIssuesBlock()),
        ("sidebar_category_block", infinitefeedblocks.SidebarCategoryBlock()),
        ("sidebar_section_block", infinitefeedblocks.SidebarSectionBlock()),         
        ("sidebar_flex_stream_block", infinitefeedblocks.SidebarFlexStreamBlock()),
        ("sidebar_latest", infinitefeedblocks.SidebarLatestBlock()),
        ("sidebar_manual", infinitefeedblocks.SidebarManualArticles())        
    ],
    null=True,
    blank=True,
    use_json_field=True,
    )

    # home_leaderboard_ad_slot = models.ForeignKey(
    #     AdSlot,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='+'
    # )
    # home_mobile_leaderboard_ad_slot = models.ForeignKey(
    #     AdSlot,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='+'
    # )
    # home_sidebar_ad_slot1 = models.ForeignKey(
    #     AdSlot,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='+'
    # )
    # home_sidebar_ad_slot2 = models.ForeignKey(
    #     AdSlot,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='+'
    # )

    content_panels = Page.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("tagline"),
                FieldPanel("tagline_url"),
            ],
            heading="Tagline"
        ),
        FieldPanel("cover_story"),
        MultiFieldPanel(
            [
                InlinePanel("top_articles"),
            ],
            heading="Top articles"
        ),
        FieldPanel("middle_stream", heading="Middle Stream"),
        FieldPanel("sidebar_stream", heading="Sidebar"),
        FieldPanel("sections_stream", heading="Sections"),
        # FieldPanel('home_leaderboard_ad_slot'),
        # FieldPanel('home_mobile_leaderboard_ad_slot'),
        # FieldPanel('home_sidebar_ad_slot1'),
        # FieldPanel('home_sidebar_ad_slot2'),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["filters"] = {}

        if self.cover_story != None:
            context["coverstory"] = self.cover_story.specific
        
        return context

    def getTopArticles(self):
        return self.top_articles.all() 
    top_articles_list = property(fget=getTopArticles)
     
    def get_all_section_slug(self):
        
        allsection_slug = []
        allsectionPages = SectionPage.objects.all()

        for section in allsectionPages:
            allsection_slug.append(section.slug)

        return allsection_slug