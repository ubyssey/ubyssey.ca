from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage
from django.db import models
from django.utils import timezone

from ads.models import AdSlot
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.models import Page, Orderable
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
        FieldPanel("cover_story_timeout"),
        FieldPanel("top_stories_timeout"),
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
        import math
        context = super().get_context(request, *args, **kwargs)
        context["filters"] = {}

        cover_story, top_stories, context["update_time"] = self.getHomeFeatured()
        context["cover_story"] = cover_story
        context["top_stories"] = top_stories
        
        exclude_from_hompage_stream = map(lambda article: article.page_ptr_id, top_stories + [cover_story])
        homepage_stream_articles = ArticlePage.objects.live().public().exclude(page_ptr_id__in=exclude_from_hompage_stream).exclude(current_section = "pages").order_by("-explicit_published_at")[:15]
        homepage_stream_groups = []
        articles_per_sidebar_item = 5
        for i in range(max(math.ceil(len(homepage_stream_articles)/articles_per_sidebar_item), len(self.sidebar_stream))):
            group = {
                'articles': homepage_stream_articles[i*articles_per_sidebar_item:(i+1)*articles_per_sidebar_item]
            }
            if i < len(self.sidebar_stream):
                group['sidebar'] = [self.sidebar_stream[i]]
            homepage_stream_groups.append(group)

        context['homepage_stream'] = homepage_stream_groups

        return context

    def getHomeFeatured(self):
        now = timezone.now().astimezone(timezone.get_current_timezone())
        update_time = self.last_published_at

        cover = None
        if not self.cover_story_timeout:
            cover = self.cover_story.specific
        elif now < self.cover_story_timeout:
            cover = self.cover_story.specific
        
        top = []
        if not self.top_stories_timeout:
            top = [article.article for article in self.top_articles.all()]
        elif now < self.top_stories_timeout:
            top = [article.article for article in self.top_articles.all()]
        else:
            filled_sections = {}
            tagged = ArticlePage.objects.live().filter(topics__slug='top-stories',first_published_at__gte=now-datetime.timedelta(weeks=4)).order_by('-first_published_at')[:15]
            if len(tagged) > 0:
                if tagged[0].first_published_at > update_time:
                    update_time = tagged[0].first_published_at
            for article in tagged:
                if article.current_section not in filled_sections:
                    filled_sections[article.current_section] = 0
                if article.current_section == "news" and not cover:
                    cover = article
                elif filled_sections[article.current_section] < 2:
                    if cover:
                        if article == cover:
                            continue
                    top.append(article)
                    filled_sections[article.current_section] = filled_sections[article.current_section] + 1
                    if len(top) >= 5:
                        break
        
        if not cover:
            cover = ArticlePage.objects.live().filter(topics__slug='top-stories',current_section='news').order_by('-first_published_at')[0]
        
        return cover, top, update_time
     
    def get_all_section_slug(self):
        
        allsection_slug = []
        allsectionPages = SectionPage.objects.all()

        for section in allsectionPages:
            allsection_slug.append(section.slug)

        return allsection_slug