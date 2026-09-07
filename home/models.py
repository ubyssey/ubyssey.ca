from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

from ads.models import AdSlot
from wagtail import blocks
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, HelpPanel, FieldRowPanel, InlinePanel
from wagtail.admin.views import generic
from wagtail.models import Site, Page, Orderable
from wagtail.fields import StreamField
from modelcluster.fields import ParentalKey
from infinitefeed import blocks as infinitefeedblocks
from events import blocks as eventblocks
from article import blocks_outer_article as articleblocks
from django.utils import timezone
import datetime
import json
from pathlib import Path
from types import SimpleNamespace
from django.conf import settings
from wagtail.snippets.models import register_snippet

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


class HomepageRedesignStory(Orderable):
    """Legacy homepage queue entries retained only for migration safety.

    The redesigned homepage now uses the five explicit hero fields on
    :class:`HomePage`; stories below the hero are automatically chronological.
    Keeping this model avoids discarding existing editor selections while the
    migration copies the first five entries into their named hero slots.
    """

    home_page = ParentalKey(
        "home.HomePage",
        related_name="redesign_story_queue",
        on_delete=models.CASCADE,
    )
    article = models.ForeignKey(
        "article.ArticlePage",
        related_name="+",
        on_delete=models.CASCADE,
    )

    panels = [FieldPanel("article")]

    class Meta:
        ordering = ("sort_order",)
        verbose_name = "Homepage story"
        verbose_name_plural = "Homepage story queue"


@register_snippet
class ThunderbirdFixture(models.Model):
    """A scheduled Thunderbird fixture. Scores are intentionally editor-managed."""

    SPORT_CHOICES = homeblocks.SPORT_CHOICES[1:]
    source_event = models.CharField(max_length=255, unique=True, editable=False)
    sport = models.CharField(max_length=20, choices=SPORT_CHOICES)
    starts_at = models.DateTimeField(db_index=True)
    venue = models.CharField(max_length=180, blank=True)
    away_name = models.CharField(max_length=100)
    home_name = models.CharField(max_length=100)
    away_logo = models.CharField(max_length=180, blank=True, editable=False)
    home_logo = models.CharField(max_length=180, blank=True, editable=False)
    away_score = models.PositiveSmallIntegerField(null=True, blank=True)
    home_score = models.PositiveSmallIntegerField(null=True, blank=True)

    panels = [
        FieldPanel("sport"), FieldPanel("starts_at"), FieldPanel("venue"),
        FieldPanel("away_name"), FieldPanel("home_name"),
        MultiFieldPanel([FieldPanel("away_score"), FieldPanel("home_score")], heading="Result (enter after the game)"),
    ]

    class Meta:
        ordering = ("starts_at",)
        verbose_name = "Thunderbird fixture"
        verbose_name_plural = "Thunderbird fixtures"

    def __str__(self):
        return f"{self.get_sport_display()}: {self.away_name} at {self.home_name} — {self.starts_at:%b %-d}"

    @property
    def away_team(self):
        return SimpleNamespace(name=self.away_name, score=self.away_score, icon=None)

    @property
    def home_team(self):
        return SimpleNamespace(name=self.home_name, score=self.home_score, icon=None)

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
        'join.JoinLandingPage',
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

    game_analysis = StreamField(
        [("panel", homeblocks.GameAnalysisPanel())],
        null=True,
        blank=True,
        max_num=1,
        use_json_field=True,
        help_text="Homepage sports analysis stories and active sports. Fixtures and scores are managed in Sports Calendar.",
    )

    newsletter_action_url = models.URLField(
        blank=True,
        default="",
        help_text="Mailchimp form action URL. Leave blank until the Mailchimp audience is configured; the preview form will remain disabled.",
    )

    HERO_HEADLINE_POSITIONS = (
        ("below", "Below the cover image (default)"),
        ("above", "Above the cover image"),
    )
    HERO_HEADLINE_VARIANTS = (
        ("default", "Default Meursault"),
        ("compact", "Compact Meursault"),
        ("wide", "Wide Meursault"),
    )

    redesign_hero_headline_position = models.CharField(
        max_length=10,
        choices=HERO_HEADLINE_POSITIONS,
        default="below",
    )
    redesign_hero_headline_variant = models.CharField(
        max_length=10,
        choices=HERO_HEADLINE_VARIANTS,
        default="default",
    )
    redesign_hero_top_left = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Top-left hero story",
    )
    redesign_hero_bottom_left = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Bottom-left hero story",
    )
    redesign_hero_centre = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Centre hero story",
    )
    redesign_hero_top_right = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Top-right hero story",
    )
    redesign_hero_bottom_right = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Bottom-right hero story",
    )
    newsletter_title = models.CharField(max_length=80, blank=True, default="")
    newsletter_copy = models.TextField(blank=True, default="")
    newsletter_button_text = models.CharField(max_length=40, blank=True, default="")
    newsletter_rss_url = models.URLField(blank=True, default="")
    newsletter_honeypot_name = models.CharField(
        max_length=160,
        blank=True,
        default="",
        help_text="Only change this with the matching anti-bot field supplied by the newsletter provider.",
    )
    print_issue_image = models.ForeignKey(
        "images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    print_issue_url = models.URLField(blank=True, default="")
    print_issue_label = models.CharField(max_length=100, blank=True, default="")

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
        FieldRowPanel(
            [
                FieldPanel("tagline"),
                FieldPanel("tagline_url"),
            ],
            heading="Tagline"
        ),
        
        HelpPanel(template="home/admin/publishingSchedule.html"),
        FieldPanel("curated_stream"),
        HelpPanel(template="home/admin/publishingScheduleScript.html"),
        FieldPanel("middle_stream", heading="Middle Stream"),
        FieldPanel("sidebar_stream", heading="Sidebar"),
        FieldPanel("sections_stream", heading="Sections"),
        FieldPanel("game_analysis", heading="Game Analyses: stories and active sports"),
        MultiFieldPanel(
            [
                FieldPanel("redesign_hero_top_left"),
                FieldPanel("redesign_hero_bottom_left"),
                FieldPanel("redesign_hero_centre"),
                FieldPanel("redesign_hero_top_right"),
                FieldPanel("redesign_hero_bottom_right"),
                FieldPanel("redesign_hero_headline_position"),
                FieldPanel("redesign_hero_headline_variant"),
            ],
            heading="Homepage redesign editorial queue",
            help_text=(
                "Set all five named hero positions. The Centre hero story uses the headline placement "
                "and Meursault controls below. Every story below the hero fills automatically in newest-first "
                "order, excluding these five stories."
            ),
        ),
        MultiFieldPanel(
            [
                FieldPanel("newsletter_action_url"), FieldPanel("newsletter_rss_url"),
                FieldPanel("newsletter_honeypot_name"),
            ],
            heading="Newsletter promotion",
        ),
        MultiFieldPanel(
            [FieldPanel("print_issue_image"), FieldPanel("print_issue_url"), FieldPanel("print_issue_label")],
            heading="Print promotion",
        ),
        # FieldPanel('home_leaderboard_ad_slot'),
        # FieldPanel('home_mobile_leaderboard_ad_slot'),
        # FieldPanel('home_sidebar_ad_slot1'),
        # FieldPanel('home_sidebar_ad_slot2'),
    ]

    def get_curated_articles(self):
        articles = []
        for child in self.curated_stream:
            articles = articles + child.block.get_articles(child.get_prep_value()["value"])

        return articles

    def clean(self):
        super().clean()
        hero_fields = (
            "redesign_hero_top_left",
            "redesign_hero_bottom_left",
            "redesign_hero_centre",
            "redesign_hero_top_right",
            "redesign_hero_bottom_right",
        )
        selected_ids = [getattr(self, f"{field}_id") for field in hero_fields if getattr(self, f"{field}_id")]
        if len(selected_ids) != len(set(selected_ids)):
            raise ValidationError("Choose a different article for each homepage hero position.")

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        panel = next((item.value for item in self.game_analysis if item.block_type == "panel"), None)
        covered_sports = list(panel.get("active_sports") or []) if panel else []
        if not covered_sports:
            covered_sports = [choice[0] for choice in homeblocks.SPORT_CHOICES[1:]]
        current_time = timezone.now()
        fixtures = ThunderbirdFixture.objects.filter(sport__in=covered_sports)
        context["panel_sports"] = covered_sports
        context["upcoming_games"] = list(fixtures.filter(starts_at__gte=current_time).order_by("starts_at")[:5])
        context["recent_results"] = list(fixtures.filter(starts_at__lt=current_time).order_by("-starts_at")[:5])

        context["curated_articles"] = self.get_curated_articles()

        # Preserve the exact editorial ordering from the existing curated stream.
        # Add recent stories only when a preview/homepage has fewer than the cards
        # required by the redesigned layout.
        ordered_articles = []
        seen = set()
        for article in context["curated_articles"]:
            # ``get_prep_value`` returns PageChooser values as their raw
            # database IDs. Resolve them before using page attributes so
            # editorially curated homepage stories work in production.
            if article and not hasattr(article, "pk"):
                try:
                    article = ArticlePage.objects.filter(pk=int(article)).first()
                except (TypeError, ValueError):
                    article = None
            if article and article.pk not in seen:
                ordered_articles.append(article.specific)
                seen.add(article.pk)

        if len(ordered_articles) < 17:
            recent = (ArticlePage.objects.live().public()
                      .descendant_of(self)
                      .exclude(pk__in=seen)
                      .order_by("-explicit_published_at")[:17 - len(ordered_articles)])
            ordered_articles.extend(article.specific for article in recent)

        if not ordered_articles and settings.DEBUG:
            # A read-only, development-only fallback built from the supplied
            # production snapshot. This keeps local visual review useful even
            # when the developer database has no editorial content.
            sample_root = Path(settings.BASE_DIR).parent / "redesign" / "redesign_sample_content"
            sample_files = [sample_root / "section-news" / "content.json", sample_root / "archive" / "content.json"]
            preview_stories = []
            preview_urls = set()
            for sample_file in sample_files:
                if not sample_file.exists():
                    continue
                payload = json.loads(sample_file.read_text())
                for story in payload.get("featured_stories", []) + payload.get("stories", []):
                    if story.get("article_url") in preview_urls:
                        continue
                    preview_urls.add(story.get("article_url"))
                    path_parts = story.get("article_url", "").split("/")
                    section = path_parts[3] if len(path_parts) > 3 else "news"
                    thumbnail = story.get("thumbnail", {})
                    local_thumbnail = sample_file.parent / thumbnail.get("local_path", "")
                    preview_index = len(preview_stories)
                    preview_date = datetime.date(2026, 8, 28) - datetime.timedelta(days=preview_index * 3)
                    preview_beats = {
                        "news": ("Campus", "AMS", "Research"),
                        "opinion": ("Opinion",),
                        "arts": ("Arts",),
                        "culture": ("Culture", "Music", "Film"),
                        "sports": ("Sports", "Thunderbirds"),
                    }
                    beat_names = preview_beats.get(section, (section.title(),))
                    beat_name = beat_names[preview_index % len(beat_names)]
                    preview_article_layouts = (
                        "big-centered", "body-width", "left-aligned",
                        "right-aligned", "full-bleed",
                    )
                    preview_stories.append(SimpleNamespace(
                        pk=f"preview-{len(preview_stories)}",
                        title=story.get("headline", ""),
                        # Keep local fixture navigation inside the redesign so
                        # homepage-to-article review exercises the new shells.
                        url=f"/redesign-preview/article/{preview_article_layouts[preview_index % 5]}/?story={path_parts[-2] if len(path_parts) > 1 else ''}",
                        lede=story.get("lede", ""),
                        current_section=section if section in {"news", "opinion", "arts", "culture", "sports"} else "news",
                        category_page=SimpleNamespace(title=beat_name, url=f"/{section}/{beat_name.lower()}/"),
                        preview_image=(f"/redesign-sample/{sample_file.parent.name}/{thumbnail['local_path']}?v=2"
                                       if local_thumbnail.is_file() else thumbnail.get("source_url", "")),
                        image_alt=thumbnail.get("alt_text", ""),
                        preview_date=preview_date.strftime("%m/%d/%Y"),
                        get_authors_split_out_visual_bylines=story.get("byline_html", story.get("byline_text", "")),
                    ))
                    if len(preview_stories) == 17:
                        break
                if len(preview_stories) == 17:
                    break
            ordered_articles = preview_stories

        hero_fields = (
            self.redesign_hero_top_left,
            self.redesign_hero_bottom_left,
            self.redesign_hero_centre,
            self.redesign_hero_top_right,
            self.redesign_hero_bottom_right,
        )
        # Named slots prevent an editor from having to count positions in an
        # ordered list. Do not turn on the editorial layout until every hero
        # position is present, so an incomplete edit cannot create a gap.
        if all(hero_fields):
            hero_articles = [article.specific for article in hero_fields]
            hero_ids = [article.pk for article in hero_articles]
            chronological_articles = list(
                ArticlePage.objects.live().public().descendant_of(self)
                .exclude(pk__in=hero_ids)
                .order_by("-explicit_published_at", "-id")[:12]
            )
            context["redesign_articles"] = hero_articles + [article.specific for article in chronological_articles]
            context["redesign_queue_active"] = True
        else:
            context["redesign_articles"] = ordered_articles
            context["redesign_queue_active"] = False

        return context
