import specialfeaturelanding.blocks as special_blocks

from article.models import UbysseyMenuMixin

from dbtemplates.models import Template as DBTemplate

from django.db import models
from django.db.models.fields.related import ForeignKey
from django.forms.widgets import Select

from section.sectionable.models import SectionablePage

from wagtail.admin.panels import (
    FieldPanel,
    MultiFieldPanel,
    InlinePanel,
    HelpPanel,
)

from modelcluster.fields import ParentalKey

from wagtail import blocks
from wagtail.models import Page, Orderable
from wagtail.fields import RichTextField, StreamField
from wagtail.images.blocks import ImageChooserBlock

from wagtailmenus.models import FlatMenu


class RedesignAuxiliaryPage(Page):
    """CMS owner for the redesigned routes that do not follow the page tree.

    The public URLs for these two pages are intentionally stable
    (``/about/our-team/`` and ``/the-vilest-rag/``).  Keeping a dedicated
    Wagtail page for each gives editors the normal draft, preview and publish
    workflow without having to repurpose a legacy landing page.
    """

    TEAM = "team"
    PODCAST = "podcast"
    CONTACT = "contact"
    PAGE_KIND_CHOICES = (
        (TEAM, "Our Team"),
        (PODCAST, "The Vilest Rag"),
        (CONTACT, "Contact"),
    )

    page_kind = models.CharField(
        max_length=20,
        choices=PAGE_KIND_CHOICES,
        unique=True,
        editable=False,
    )
    display_title = models.CharField(
        max_length=100,
        help_text="The title displayed to readers. The CMS page title stays descriptive for editors.",
    )
    description = RichTextField(
        blank=True,
        default="",
        help_text="Optional introductory copy displayed below the page title.",
    )
    featured_media = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="hero image",
    )
    spotify_episode_url = models.URLField(
        blank=True,
        default="",
        help_text="The public Spotify episode URL for the Latest episode player.",
    )

    parent_page_types = ["home.HomePage"]
    subpage_types = []
    show_in_menus_default = False

    content_panels = Page.content_panels + [
        HelpPanel(
            content=(
                "<p>This CMS page controls the redesigned public route directly. "
                "Publish changes here, then view the public page from the link in the panel above.</p>"
            ),
        ),
        FieldPanel("display_title"),
        FieldPanel("description"),
        FieldPanel("featured_media"),
        FieldPanel("spotify_episode_url"),
        InlinePanel(
            "team_members",
            heading="Our Team roster",
            label="Team member",
            help_text=(
                "For the Our Team page, add members in the order they should appear and "
                "choose their department. This curated roster is also shown automatically "
                "in the Contact directory."
            ),
        ),
        InlinePanel(
            "contact_entries",
            heading="Contact-only directory entries",
            label="Contact entry",
            help_text=(
                "Use on the Contact page for Business Office and other people who should "
                "not appear on Our Team. These entries are ignored on other page types."
            ),
        ),
    ]

    class Meta:
        verbose_name = "Redesigned auxiliary page"
        verbose_name_plural = "Redesigned auxiliary pages"

    def get_template(self, request, *args, **kwargs):
        if self.page_kind == self.TEAM:
            return "support/our_team.html"
        if self.page_kind == self.CONTACT:
            return "support/masthead.html"
        return "section/podcast_page.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        if self.page_kind in {self.TEAM, self.CONTACT}:
            groups = {"senior": [], "reportage": [], "visuals": [], "product": []}
            # The Our Team page is the sole editorial source for staff. Contact
            # mirrors it, rather than falling back to every historic author.
            team_page = self
            if self.page_kind == self.CONTACT:
                team_page = type(self).objects.live().filter(page_kind=self.TEAM).first()
            if team_page:
                for member in team_page.team_members.select_related("author").all():
                    groups[member.department].append(member)
            context["redesign_staff_groups"] = groups
            if self.page_kind == self.CONTACT:
                context["redesign_contact_entries"] = self.contact_entries.all()
        else:
            from article.models import ArticlePage
            from section.models import SectionPage

            # Production has used both a canonical section-page tree and the
            # denormalized current_section field for podcast stories. Support
            # both structures so existing episodes do not disappear during the
            # redesigned-route migration.
            podcast_section = SectionPage.objects.live().filter(slug="the-vilest-rag").first()
            episodes = ArticlePage.objects.live().public().filter(
                current_section="the-vilest-rag"
            )
            if podcast_section:
                episodes = episodes | ArticlePage.objects.live().public().descendant_of(
                    podcast_section
                )
            context["redesign_all_articles"] = episodes.order_by(
                "-explicit_published_at", "-id"
            ).distinct()[:20]
        return context


class RedesignTeamMember(Orderable):
    """An explicitly curated author card on the redesigned Our Team page."""

    SENIOR = "senior"
    REPORTAGE = "reportage"
    VISUALS = "visuals"
    PRODUCT = "product"
    DEPARTMENT_CHOICES = (
        (SENIOR, "Senior Masthead"),
        (REPORTAGE, "Reportage"),
        (VISUALS, "Visuals"),
        (PRODUCT, "Product"),
    )

    page = ParentalKey(
        "specialfeaturelanding.RedesignAuxiliaryPage",
        on_delete=models.CASCADE,
        related_name="team_members",
    )
    author = models.ForeignKey(
        "authors.AuthorPage",
        on_delete=models.CASCADE,
        related_name="+",
    )
    department = models.CharField(max_length=20, choices=DEPARTMENT_CHOICES)
    description_override = models.TextField(
        blank=True,
        default="",
        help_text=(
            "Optional longer description for this card only. It overrides the "
            "author page's short biography without changing the author page."
        ),
    )

    panels = [
        FieldPanel("department"),
        FieldPanel("author"),
        FieldPanel("description_override"),
    ]

    class Meta:
        verbose_name = "Our Team member"
        verbose_name_plural = "Our Team members"


class RedesignContactEntry(Orderable):
    """A Contact-directory person who is not a member of the Our Team roster."""

    page = ParentalKey(
        "specialfeaturelanding.RedesignAuxiliaryPage",
        on_delete=models.CASCADE,
        related_name="contact_entries",
    )
    role = models.CharField(max_length=120)
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)

    panels = [
        FieldPanel("role"),
        FieldPanel("name"),
        FieldPanel("email"),
    ]

    class Meta:
        verbose_name = "Contact-only directory entry"
        verbose_name_plural = "Contact-only directory entries"


class SpecialLandingPage(SectionablePage, UbysseyMenuMixin):
    """
    This is the general model for "special features" landing pages, such as for the guide, or a magazine.

    Pages can select them to automatically create
    """
    #-----Layout stuff-----
    # template = "specialfeaturelanding/base.html"
    # template = "specialfeaturelanding/landing_page_guide_2022_style.html"

    use_default_template = models.BooleanField(default=True)

    category_page = models.ForeignKey(
        "section.CategoryPage",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )
    
    layout = models.CharField(
        null=False,
        blank=False,
        default='default',
        verbose_name='Article Layout',
        help_text="These correspond to very frequently used templates. More \"bespoke\", one-off templates should be added to the library of DB Templates",
        max_length=100,
    )

    db_template = models.ForeignKey(
        DBTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',        
    )

    spotify_episode_url = models.URLField(
        blank=True,
        default="",
        help_text="Paste the public Spotify episode URL used by the Latest Episode player.",
    )

    def get_template(self, request):
        support_templates = {
            "our-journalism": "support/our_journalism.html",
            "our-team": "support/our_team.html",
            "masthead": "support/masthead.html",
            "ups-board": "support/ups_board.html",
            "board": "support/ups_board.html",
            "the-vilest-rag": "section/podcast_page.html",
        }
        if self.slug in support_templates:
            return support_templates[self.slug]
        if not self.use_default_template:
            if self.db_template:
                return self.db_template.name

        if self.layout == 'default':
            return "specialfeaturelanding/base.html"
        elif self.layout == 'guide-2020':
            return "guide/2020/index.html"
        elif self.layout == 'guide-2020-section':
            return "guide/2020/section.html"
        elif self.layout == 'guide-2022':
            return "specialfeaturelanding/landing_page_guide_2022_style.html"
        elif self.layout == 'mag-2023':
            return "specialfeaturelanding/mag_2023_style.html"
        elif self.layout == 'guide-2023':
            return "specialfeaturelanding/landing_page_guide_2023_style.html"
        elif self.layout == 'mag-2024':
            return "specialfeaturelanding/mag_2024_style.html"
        elif self.layout == 'spoof-2024':
            return "specialfeaturelanding/spoof_2024_style.html"
        elif self.layout == 'spoof-2026':
            return "specialfeaturelanding/spoof_2026_style.html"
        return "specialfeaturelanding/base.html"

    parent_page_types = [
        'section.SectionPage',
        'specialfeaturelanding.SpecialLandingPage',
    ]

    subpage_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'article.StandardArticlePage',
    ]
    
    show_in_menus_default = True

    #-----Fields-----
    main_class_name = models.CharField(
        null=False,
        blank=True,
        default='home-content-container',
        max_length=255,
    )

    editorial_stream = StreamField(
        [
            ('banner', special_blocks.BannerBlock()),
            ('credits', special_blocks.EditorialBlock()),
            ('image', ImageChooserBlock()),
            ('note_with_header', special_blocks.NoteWithHeaderBlock()),
            ('graphical_menu', special_blocks.GraphicalMenuBlock()),
            ('child_articles', special_blocks.ChildArticlesBlock()),
            ('flex_stream', special_blocks.DivStreamBlock()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    content = StreamField(
        [
            ('quote', special_blocks.QuoteBlock(
                label="Quote Block",
            )),
            ('stylecta',special_blocks.CustomStylingCTABlock(
                label="Custom Styling CTA",
            )),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    graphical_menu = StreamField(
        [
            ('menu_item', special_blocks.GraphicalMenuItemBlock(
                label="Graphical (Cover) Link"
            )), 
            ('menu_item', special_blocks.TextDivBlock(
                label="Text"
            )), 
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    featured_media = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='featured_image',
        verbose_name="featured image",
    )

    content_panels = Page.content_panels + UbysseyMenuMixin.menu_content_panels + [
        HelpPanel(
            content=(
                "<p><strong>Redesigned auxiliary pages:</strong> the pages titled “Our Team” and “The Vilest Rag” "
                "power their public routes directly. Find them in Pages by title. “Our Team” draws people from "
                "Author pages; “The Vilest Rag” draws episodes from its child articles and uses the Spotify field below.</p>"
            ),
        ),
        MultiFieldPanel(
            [
                HelpPanel(content='Used for targetting <main> by the css'),
                FieldPanel('main_class_name'),
            ],
            heading="Styling",
        ),
        # MultiFieldPanel(
        #     [
        #         HelpPanel(
        #             content='<h1>TODO</h1><p>Write something here</p>'
        #         ),
        #         FieldPanel("content"),
        #     ],
        #     heading="Article Content",
        #     classname="collapsible",
        # ),
        MultiFieldPanel(
            [
                FieldPanel("editorial_stream"),
            ],
            heading="Editorial Content"
        ),

        MultiFieldPanel(
            [
                InlinePanel(
                    "feature_credits",
                    label="Credits",                    
                )
            ],
            heading="Feature Credits",
            classname="collapsible",
        ),
         MultiFieldPanel(
            [
                FieldPanel("category_page"),
            ],
            heading="Categories",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                FieldPanel(
                    "layout",
                    widget=Select(
                        choices=[
                            ('default', 'Default'), 
                            ('guide-2020', 'Guide (2020 style)'),
                            ('guide-2020-section', 'Guide (2020 Section Landing Page)'),
                            ('guide-2022', 'Guide (2022 style)'),
                            ('mag-2023', 'Magazine (2023 style)'),
                            ('guide-2023', 'Guide (2023 style)'),
                            ('mag-2024', 'Magazine (2024 style)'),
                            ('spoof-2024', 'Spoof (2024 style)'),
                            ('spoof-2026', 'Spoof (2026 style)'),
                        ],
                    ),
                ),
            ],
            heading = "Select Stock Layout",
            classname="collapsible collapsed",
        ), # Select Stock Layout


        MultiFieldPanel(
            [
                FieldPanel("featured_media"),
                FieldPanel("spotify_episode_url"),
            ],
            heading="Meta Image",
        ),
    ]


    def get_context(self, request, *args, **kwargs):        
        context = super().get_context(request, *args, **kwargs)
        if self.slug == "the-vilest-rag":
            from article.models import ArticlePage
            episodes = ArticlePage.objects.live().public().descendant_of(self).order_by("-explicit_published_at")[:20]
            if not episodes:
                episodes = ArticlePage.objects.live().public().filter(current_section=self.slug).order_by("-explicit_published_at")[:20]
            context["redesign_all_articles"] = episodes
        if self.slug in {"our-team", "masthead"}:
            from authors.models import AuthorPage
            staff = list(AuthorPage.objects.live().exclude(ubyssey_role="").order_by("full_name"))
            groups = {"senior": [], "reportage": [], "visuals": [], "product": []}
            for person in staff:
                role = person.ubyssey_role.lower()
                if "editor-in-chief" in role or "managing editor" in role:
                    groups["senior"].append(person)
                elif any(word in role for word in ("visual", "photo", "video", "illustr", "audio", "design")):
                    groups["visuals"].append(person)
                elif any(word in role for word in ("product", "web", "developer", "engagement", "newsletter")):
                    groups["product"].append(person)
                else:
                    groups["reportage"].append(person)
            context["redesign_staff"] = staff
            context["redesign_staff_groups"] = groups
        # for i, block in self.body:
        #     print('hello world ' + i)
        #     context['article' + i] = Article.objects.get(is_published=1, slug=block)
        return context

class CreditsOrderable(Orderable):
    special_landing_page = ParentalKey(
        "specialfeaturelanding.SpecialLandingPage",
        related_name="feature_credits",
    )

    role = models.CharField(
        max_length=100,
        blank=True,
        null=False,
    )

    author = models.ForeignKey(
        "authors.AuthorPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="If null or blank, will use the name entered in \"Author Name\" field",
    )

    author_name = models.CharField(
        max_length=100,
        blank=True,
        null=False,
    )
