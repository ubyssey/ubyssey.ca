from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage , CategorySnippet
from django.db import models
from django.utils import timezone

from ads.models import AdSlot
from wagtail.admin.edit_handlers import FieldPanel, StreamFieldPanel
from wagtail.core.models import Page
from wagtail.core.fields import StreamField
from wagtailmodelchooser.edit_handlers import ModelChooserPanel

# Create your models here.

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
    ]

    above_cut_stream = StreamField(
        [
            ("above_cut_block", homeblocks.AboveCutBlock())
        ],
        null=True,
        blank=True,
    )

    sections_stream = StreamField(
        [
            ("home_page_section_block", homeblocks.HomepageFeaturedSectionBlock())
        ],
        null=True,
        blank=True,
    )

    sidebar_stream = StreamField(
        [
            ("sidebar_advertisement_block", homeblocks.SidebarAdvertisementBlock()),
            ("sidebar_issuu_block", homeblocks.SidebarIssuuBlock()),
            ("sidebar_section_block", homeblocks.SidebarSectionBlock()),            
        ],
        null=True,
        blank=True,
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
        StreamFieldPanel("above_cut_stream", heading="\"Above the Cut\" Content"),
        StreamFieldPanel("sections_stream", heading="Sections"),
        StreamFieldPanel("sidebar_stream", heading="Sidebar"),
        # ModelChooserPanel('home_leaderboard_ad_slot'),
        # ModelChooserPanel('home_mobile_leaderboard_ad_slot'),
        # ModelChooserPanel('home_sidebar_ad_slot1'),
        # ModelChooserPanel('home_sidebar_ad_slot2'),
    ]
                 
    def get_all_section_slug(self):
        
        allsection_slug = []
        allsectionPages = SectionPage.objects.all()

        for section in allsectionPages:
            allsection_slug.append(section.slug)

        return allsection_slug