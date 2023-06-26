from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage , CategorySnippet
from django.db import models
from django.utils import timezone

from ads.models import AdSlot
from wagtail.admin.edit_handlers import FieldPanel, StreamFieldPanel, PageChooserPanel, MultiFieldPanel, InlinePanel
from wagtail.core.models import Page, Orderable
from wagtail.core.fields import StreamField
from wagtailmodelchooser.edit_handlers import ModelChooserPanel
from modelcluster.fields import ParentalKey
from infinitefeed import models as infinitefeed

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
                PageChooserPanel('article'),
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
        "article.ArticlePage",
        related_name = "cover_story",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    links = StreamField(
        [
            ("link", homeblocks.LinkStreamBlock()),
        ],
        null=True,
        blank=True,
    )

    sidebar_stream = infinitefeed.sidebar_stream

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
        PageChooserPanel("cover_story"),
        InlinePanel("top_articles"),
        StreamFieldPanel("links", heading="Links"),
        StreamFieldPanel("sidebar_stream", heading="Sidebar"),
        # ModelChooserPanel('home_leaderboard_ad_slot'),
        # ModelChooserPanel('home_mobile_leaderboard_ad_slot'),
        # ModelChooserPanel('home_sidebar_ad_slot1'),
        # ModelChooserPanel('home_sidebar_ad_slot2'),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["filters"] = {}
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