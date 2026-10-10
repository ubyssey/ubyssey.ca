from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage
from django.db import models
from django.core.exceptions import ObjectDoesNotExist, ValidationError
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

    # Preserve legacy choice labels so editors can still view historical
    # Women's Rugby fixtures. The homepage panel itself filters to the active
    # Game Analyses programme in ``get_context``.
    SPORT_CHOICES = homeblocks.COVERED_SPORT_CHOICES
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

    @property
    def game_analysis_story(self):
        """Return the linked live Game Analysis story, if there is one."""
        try:
            article = self.game_analysis_article
        except ObjectDoesNotExist:
            return None
        return article if article.live and article.story_form == "game-analysis" else None

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
        'specialfeaturelanding.RedesignAuxiliaryPage',
        'home.BCLocalElectionsPage',
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
    game_analysis_enabled = models.BooleanField(
        default=True,
        help_text="Show Game Analyses on the homepage. Turn off to skip the panel and its story and fixture queries.",
    )

    AMS_ELECTION_PLACEMENTS = (
        ("before_hero", "Above the top stories"),
        ("between_hero_games", "Between the top stories and Game Analyses (default)"),
        ("after_games", "Below Game Analyses"),
    )
    ams_election_enabled = models.BooleanField(
        default=False,
        help_text="Show the election feature only after its description and both story slots are ready.",
    )
    ams_election_placement = models.CharField(
        max_length=24, choices=AMS_ELECTION_PLACEMENTS, default="between_hero_games",
    )
    ams_election_heading = models.CharField(
        max_length=120, default="2026 AMS VP Student Life By-Election",
    )
    ams_election_description = models.TextField(blank=True, default="")
    ams_election_story_left = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Left election story",
    )
    ams_election_story_right = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="Right election story",
    )

    bc_elections_page = models.ForeignKey(
        "home.BCLocalElectionsPage", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
        help_text="Select the election page whose story slots and party logos feed the homepage feature.",
    )
    bc_elections_banner_enabled = models.BooleanField(default=False)
    bc_elections_banner_text = models.CharField(
        max_length=150, default="2026 BC GENERAL LOCAL ELECTIONS",
    )
    bc_elections_panel_enabled = models.BooleanField(default=False)
    bc_elections_panel_heading = models.CharField(
        max_length=150, default="2026 BC General Local Elections",
    )
    bc_elections_panel_description = models.TextField(blank=True, default="")
    bc_elections_explainers_heading = models.CharField(
        max_length=100, default="About the Elections",
    )
    bc_elections_vancouver_heading = models.CharField(
        max_length=100, default="Vancouver Mayoral Candidates",
    )
    bc_elections_parties_heading = models.CharField(
        max_length=100, default="About the Parties",
    )
    bc_elections_metro_link_text = models.CharField(
        max_length=120, default="Explore Greater Vancouver mayoral candidates",
    )
    bc_elections_show_explainers = models.BooleanField(default=True)
    bc_elections_show_vancouver = models.BooleanField(default=True)
    bc_elections_show_parties = models.BooleanField(default=True)
    bc_elections_show_live_results = models.BooleanField(default=True)

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
        MultiFieldPanel(
            [FieldPanel("game_analysis_enabled"), FieldPanel("game_analysis")],
            heading="Game Analyses: visibility, stories and active sports",
        ),
        MultiFieldPanel(
            [
                FieldPanel("ams_election_enabled"),
                FieldPanel("ams_election_placement"),
                FieldPanel("ams_election_heading"),
                FieldPanel("ams_election_description"),
                FieldPanel("ams_election_story_left"),
                FieldPanel("ams_election_story_right"),
            ],
            heading="AMS election feature",
            help_text="Choose two different stories and a description before enabling. Only live, public stories appear on the homepage.",
        ),
        MultiFieldPanel(
            [
                FieldPanel("bc_elections_page"),
                FieldPanel("bc_elections_banner_enabled"),
                FieldPanel("bc_elections_banner_text"),
                FieldPanel("bc_elections_panel_enabled"),
                FieldPanel("bc_elections_panel_heading"),
                FieldPanel("bc_elections_panel_description"),
                FieldPanel("bc_elections_explainers_heading"),
                FieldPanel("bc_elections_vancouver_heading"),
                FieldPanel("bc_elections_parties_heading"),
                FieldPanel("bc_elections_metro_link_text"),
                FieldPanel("bc_elections_show_live_results"),
                FieldPanel("bc_elections_show_explainers"),
                FieldPanel("bc_elections_show_vancouver"),
                FieldPanel("bc_elections_show_parties"),
            ],
            heading="2026 BC local elections: homepage banner and panel",
            help_text="Create and publish the election page first. The banner and panel are independently off by default; story slots and logos are edited on the linked election page.",
        ),
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
                "order, excluding these five stories and Game Analysis stories."
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
        if (self.bc_elections_banner_enabled or self.bc_elections_panel_enabled) and not self.bc_elections_page_id:
            raise ValidationError("Choose the BC local elections page before enabling its homepage banner or panel.")
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
        if self.ams_election_enabled:
            if not (self.ams_election_heading.strip() and self.ams_election_description.strip()):
                raise ValidationError("Add a heading and description before enabling the AMS election feature.")
            if not (self.ams_election_story_left_id and self.ams_election_story_right_id):
                raise ValidationError("Choose both AMS election stories before enabling the feature.")
            if self.ams_election_story_left_id == self.ams_election_story_right_id:
                raise ValidationError("Choose two different AMS election stories.")

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        context["bc_elections_page"] = None
        context["bc_elections_content"] = None
        if self.bc_elections_page_id and (
            self.bc_elections_banner_enabled or self.bc_elections_panel_enabled
        ):
            election_page = BCLocalElectionsPage.objects.live().public().filter(
                pk=self.bc_elections_page_id,
            ).first()
            if election_page:
                context["bc_elections_page"] = election_page
                if self.bc_elections_panel_enabled:
                    context["bc_elections_content"] = election_page.get_election_content(
                        include_metro=False,
                        include_live=self.bc_elections_show_live_results,
                    )

        context["ams_election_stories"] = []
        if (self.ams_election_enabled and self.ams_election_story_left_id
                and self.ams_election_story_right_id
                and self.ams_election_story_left_id != self.ams_election_story_right_id):
            selected = ArticlePage.objects.live().public().filter(pk__in=(
                self.ams_election_story_left_id, self.ams_election_story_right_id,
            )).specific()
            stories_by_id = {article.pk: article for article in selected}
            if all(story_id in stories_by_id for story_id in (
                    self.ams_election_story_left_id, self.ams_election_story_right_id)):
                context["ams_election_stories"] = [
                    stories_by_id[self.ams_election_story_left_id],
                    stories_by_id[self.ams_election_story_right_id],
                ]

        # A configured StreamField panel supplies its own stories and fixtures.
        # Do not run the fallback queries as well: their results are discarded
        # by include_block, but used to load every historical analysis here.
        if self.game_analysis_enabled and not any(
            item.block_type == "panel" for item in self.game_analysis
        ):
            from home.game_analysis_queries import chronological_articles, fixture_queues, panel_active_sports

            covered_sports = panel_active_sports()
            context["panel_sports"] = covered_sports
            context["upcoming_games"], context["recent_results"] = fixture_queues(
                covered_sports, timezone.now()
            )
            context["analysis_articles"] = [
                {"article": article, "sport": article.covered_sport}
                for article in chronological_articles(covered_sports)
            ]

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

        # The top fold keeps its editorial choices (or the usual recent-story
        # fallback), including Game Analysis stories. Only the twelve rows
        # below it should exclude that story form.
        if len(ordered_articles) < 5:
            recent = (ArticlePage.objects.live().public()
                      .descendant_of(self)
                      .exclude(pk__in=seen)
                      .order_by("-explicit_published_at")[:5 - len(ordered_articles)])
            for article in recent:
                ordered_articles.append(article.specific)
                seen.add(article.pk)

        ordered_articles = ordered_articles[:5] + [
            article for article in ordered_articles[5:]
            if getattr(article, "story_form", "") != "game-analysis"
        ]
        if len(ordered_articles) < 17:
            recent = (ArticlePage.objects.live().public()
                      .descendant_of(self)
                      .exclude(pk__in=seen)
                      .exclude(standardarticlepage__story_form="game-analysis")
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
                .exclude(standardarticlepage__story_form="game-analysis")
                .order_by("-explicit_published_at", "-id")[:12]
            )
            context["redesign_articles"] = hero_articles + [article.specific for article in chronological_articles]
            context["redesign_queue_active"] = True
        else:
            context["redesign_articles"] = ordered_articles
            context["redesign_queue_active"] = False

        return context


class BCLocalElectionsPage(Page):
    """Editor-curated hub for the 2026 BC local elections."""

    template = "home/bc_local_elections_page.html"
    parent_page_types = ["home.HomePage"]
    subpage_types = []
    show_in_menus_default = False

    intro_kicker = models.CharField(
        max_length=100, default="The Ubyssey · Election coverage",
    )
    election_summary = models.TextField(
        blank=True, default="", help_text="Short description below the page title.",
    )
    about_heading = models.CharField(max_length=100, default="About the Elections")
    vancouver_heading = models.CharField(max_length=100, default="Vancouver Mayoral Candidates")
    parties_heading = models.CharField(max_length=100, default="About the Parties")
    metro_heading = models.CharField(max_length=100, default="Greater Vancouver Mayoral Candidates")
    parties_extra_text = models.TextField(
        blank=True, default="", help_text="Optional note in the eighth position of the party grid.",
    )
    live_results_article = models.ForeignKey(
        "article.ArticlePage", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", help_text="Optional live-results story shown above the four story sections.",
    )
    live_results_label = models.CharField(max_length=100, default="Election results")
    live_active_label = models.CharField(max_length=30, default="LIVE")
    live_results_ended_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Optional end time shown once live updates stop. Defaults to the last update time.",
    )

    content_panels = Page.content_panels + [
        MultiFieldPanel(
            [FieldPanel("intro_kicker"), FieldPanel("election_summary"),
             FieldPanel("live_results_article"), FieldPanel("live_results_label"),
             FieldPanel("live_active_label"),
             FieldPanel("live_results_ended_at")],
            heading="Introduction and live results",
        ),
        MultiFieldPanel(
            [FieldPanel("about_heading"), InlinePanel("explainers", max_num=3, label="Explainer")],
            heading="About the Elections: up to three stories",
        ),
        MultiFieldPanel(
            [FieldPanel("vancouver_heading"), InlinePanel("vancouver_profiles", max_num=6, label="Profile")],
            heading="Vancouver mayoral candidates: up to six profiles",
        ),
        MultiFieldPanel(
            [FieldPanel("parties_heading"), FieldPanel("parties_extra_text"),
             InlinePanel("party_profiles", max_num=7, label="Party")],
            heading="About the Parties: up to seven profiles",
        ),
        MultiFieldPanel(
            [FieldPanel("metro_heading"), InlinePanel("metro_profiles", max_num=8, label="Profile")],
            heading="Greater Vancouver mayoral candidates: up to eight profiles",
        ),
    ]

    def clean(self):
        super().clean()
        if self.slug != "2026-bc-general-local-elections":
            raise ValidationError({"slug": "Use 2026-bc-general-local-elections for the public election URL."})

    def get_election_content(self, *, include_metro=True, include_live=True):
        """Resolve only manually selected, live and public stories in one bounded query."""
        relations = {
            "explainers": self.explainers,
            "vancouver": self.vancouver_profiles,
            "parties": self.party_profiles,
        }
        if include_metro:
            relations["metro"] = self.metro_profiles

        rows = {
            name: list(relation.order_by("sort_order"))
            for name, relation in relations.items()
        }
        story_ids = {
            row.article_id for group in rows.values() for row in group if row.article_id
        }
        if include_live and self.live_results_article_id:
            story_ids.add(self.live_results_article_id)
        stories = {
            story.pk: story for story in ArticlePage.objects.live().public()
            .filter(pk__in=story_ids).specific()
        } if story_ids else {}
        content = {
            name: [
                SimpleNamespace(
                    article=stories[row.article_id],
                    label=row.display_label,
                    special=getattr(row, "is_context_card", False),
                    logo_id=getattr(row, "logo_id", None),
                    logo=row.logo if getattr(row, "logo_id", None) else None,
                    description=getattr(row, "description", ""),
                )
                for row in group if row.article_id in stories
            ]
            for name, group in rows.items()
        }
        live_article = stories.get(self.live_results_article_id) if include_live else None
        content["live_article"] = live_article
        content["live_active"] = bool(live_article and live_article.is_live())
        content["live_ended_at"] = (
            self.live_results_ended_at
            or (live_article.updated_at() if live_article and hasattr(live_article, "updated_at") else None)
            or (live_article.explicit_published_at if live_article else None)
        )
        return content

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["election_content"] = self.get_election_content()
        return context


class BCElectionStorySlot(Orderable):
    """Shared editable fields for the four ordered groups of election stories."""

    article = models.ForeignKey(
        "article.ArticlePage", null=True, on_delete=models.SET_NULL, related_name="+",
    )
    display_label = models.CharField(
        max_length=100, blank=True, default="",
        help_text="Optional short label; article headline remains the link text.",
    )
    panels = [FieldPanel("article"), FieldPanel("display_label")]

    class Meta:
        abstract = True
        ordering = ("sort_order",)


class BCElectionExplainer(BCElectionStorySlot):
    page = ParentalKey("home.BCLocalElectionsPage", on_delete=models.CASCADE, related_name="explainers")


class BCElectionVancouverProfile(BCElectionStorySlot):
    page = ParentalKey("home.BCLocalElectionsPage", on_delete=models.CASCADE, related_name="vancouver_profiles")
    is_context_card = models.BooleanField(
        default=False,
        help_text="Use for the MVRD acclaimed profile and information mix; gives the card a distinct treatment.",
    )
    panels = BCElectionStorySlot.panels + [FieldPanel("is_context_card")]


class BCElectionPartyProfile(BCElectionStorySlot):
    page = ParentalKey("home.BCLocalElectionsPage", on_delete=models.CASCADE, related_name="party_profiles")
    logo = models.ForeignKey(
        "images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    description = models.TextField(blank=True, default="")
    panels = BCElectionStorySlot.panels + [FieldPanel("logo"), FieldPanel("description")]


class BCElectionMetroProfile(BCElectionStorySlot):
    page = ParentalKey("home.BCLocalElectionsPage", on_delete=models.CASCADE, related_name="metro_profiles")
