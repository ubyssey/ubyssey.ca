from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage
from django.db import models
from django.utils import timezone

from ads.models import AdSlot
from wagtail import blocks
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.models import Site, Page, Orderable
from wagtail.fields import StreamField
from modelcluster.fields import ParentalKey
from infinitefeed import blocks as infinitefeedblocks
from events import blocks as eventblocks
from article import blocks_outer_article as articleblocks
from django.utils import timezone
import datetime

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

    cover_story_timeout = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Cover story timeout",
        help_text = "Before this date the manually set coverstory will be displayed. After this date the most recent News article tagged with 'Top stories' will be used as the cover story.",
    )

    top_stories_timeout = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Top stories timeout",
        help_text = "Before this date the manually set top stories list will be displayed. After this date the top stories list will be the 5 most recent articles tagged with 'Top stories'. Each section is limited to two articles. Only articles published in the last 2 weeks are included.",
    )

    curated_stream = StreamField(
        [
            ("curated_group", homeblocks.CuratedGroup()),
            ("curated_group_cards", homeblocks.CuratedGroupCards()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    middle_stream = StreamField(
        [
            ("links", homeblocks.LinksStreamBlock()),
            ('article_gatherer', articleblocks.ArticleGathererBlock()),
            ('landing', articleblocks.SpecialLandingPageBlock()),
            ('article_manual', articleblocks.ManualArticles()),
            ('events_bar', eventblocks.MidstreamEventsBar())
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    sections_stream = StreamField(
        [
            ("home_page_section_block", articleblocks.SectionBlock()),
            ("home_page_section_block_categorized", articleblocks.SectionCategorizedBlock()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    sidebar_stream = StreamField(
    [
        ("sidebar_advertisement_block", infinitefeedblocks.SidebarAdvertisementBlock()),
        ("sidebar_issues_block", infinitefeedblocks.SidebarIssuesBlock()),
        ("sidebar_flex_stream_block", infinitefeedblocks.SidebarFlexStreamBlock()),
        ("sidebar_gatherer_block", infinitefeedblocks.SidebarArticleGatherer()),
        ("sidebar_manual", infinitefeedblocks.SidebarManualArticles()),
        ("siderbar_events_block", eventblocks.SidebarEventsBlock()),
        ("sidebar_recent_stories", homeblocks.RecentStoriesByDay()),
        ("sidebar_recent_stories__clustered", homeblocks.RecentStoriesByTopic()),
        ("sidebar_newsletter_signup", homeblocks.SidebarNewsletterSignup()),
        ("sidebar_raw_html", blocks.RawHTMLBlock()),
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
        FieldPanel("curated_stream"),
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
        
        articles = []
        for group in self.curated_stream.raw_data:
            for item in group["value"]["items"]:
                articles.append(item["value"]["article"])

        context["curated_articles"] = articles

        return context
