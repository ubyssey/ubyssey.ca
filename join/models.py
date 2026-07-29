from django.db import models
from modelcluster.fields import ParentalKey
from wagtail.admin.panels import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.fields import RichTextField
from wagtail.models import Orderable, Page


class JoinLandingPage(Page):
    """The recruitment landing page at /join/."""

    template = "join/join_landing_page.html"
    max_count = 1
    parent_page_types = ["home.HomePage"]
    subpage_types = ["join.JoinUnitPage"]
    show_in_menus_default = True

    hero_eyebrow = models.CharField(
        max_length=120,
        default="So you want to be a journalist?",
    )
    hero_heading = models.CharField(
        max_length=120,
        default="Join The Ubyssey",
    )
    hero_image = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    introduction = RichTextField(
        blank=True,
        features=["bold", "italic", "link"],
    )

    reportage_description = models.TextField(blank=True)
    visuals_description = models.TextField(blank=True)
    product_description = models.TextField(blank=True)

    application_process_heading = models.CharField(
        max_length=160,
        default="Application Process",
    )
    application_process_introduction = models.TextField(
        blank=True,
        default=(
            "Our application process takes about three weeks, from the time "
            "we post roles to when we onboard new hires."
        ),
    )
    application_form_url = models.URLField(
        blank=True,
        help_text=(
            "Shared application form used by every open position. Positions "
            "remain closed until this URL is populated."
        ),
    )

    faq_heading = models.CharField(
        max_length=160,
        default="Frequently Asked Questions about the CJP",
    )
    career_heading = models.CharField(
        max_length=160,
        default="Growing with The Ubyssey",
    )
    career_introduction = models.TextField(blank=True)

    content_panels = Page.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("hero_eyebrow"),
                FieldPanel("hero_heading"),
                FieldPanel("hero_image"),
                FieldPanel("introduction"),
            ],
            heading="Hero and introduction",
        ),
        MultiFieldPanel(
            [
                FieldPanel("reportage_description"),
                FieldPanel("visuals_description"),
                FieldPanel("product_description"),
            ],
            heading="Unit group descriptions",
        ),
        MultiFieldPanel(
            [
                FieldPanel("application_process_heading"),
                FieldPanel("application_process_introduction"),
                FieldPanel("application_form_url"),
                InlinePanel("application_steps", label="Application step"),
            ],
            heading="Application process",
        ),
        MultiFieldPanel(
            [
                FieldPanel("faq_heading"),
                InlinePanel("faqs", label="FAQ"),
            ],
            heading="Frequently asked questions",
        ),
        MultiFieldPanel(
            [
                FieldPanel("career_heading"),
                FieldPanel("career_introduction"),
                InlinePanel("career_stages", label="Career stage"),
            ],
            heading="Career path",
        ),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        units = list(
            JoinUnitPage.objects.child_of(self)
            .live()
            .public()
            .prefetch_related("positions")
            .order_by("path")
        )
        for unit in units:
            unit._join_landing = self
        context["unit_groups"] = [
            {
                "slug": category,
                "heading": label,
                "description": getattr(self, f"{category}_description"),
                "units": [unit for unit in units if unit.category == category],
            }
            for category, label in JoinUnitPage.CATEGORY_CHOICES
        ]
        return context


class JoinApplicationStep(Orderable):
    page = ParentalKey(
        JoinLandingPage,
        related_name="application_steps",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=160)
    description = models.TextField()

    panels = [
        FieldPanel("title"),
        FieldPanel("description"),
    ]

    def __str__(self):
        return self.title


class JoinFAQ(Orderable):
    page = ParentalKey(
        JoinLandingPage,
        related_name="faqs",
        on_delete=models.CASCADE,
    )
    question = models.CharField(max_length=255)
    answer = RichTextField(features=["bold", "italic", "link", "ol", "ul"])

    panels = [
        FieldPanel("question"),
        FieldPanel("answer"),
    ]

    def __str__(self):
        return self.question


class JoinCareerStage(Orderable):
    page = ParentalKey(
        JoinLandingPage,
        related_name="career_stages",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField()

    panels = [
        FieldPanel("title"),
        FieldPanel("subtitle"),
        FieldPanel("description"),
    ]

    def __str__(self):
        return self.title


class JoinUnitPage(Page):
    """A reusable recruitment page for one editorial or product unit."""

    CATEGORY_REPORTAGE = "reportage"
    CATEGORY_VISUALS = "visuals"
    CATEGORY_PRODUCT = "product"
    CATEGORY_CHOICES = [
        (CATEGORY_REPORTAGE, "Reportage"),
        (CATEGORY_VISUALS, "Visuals"),
        (CATEGORY_PRODUCT, "Product"),
    ]

    UNIT_TYPE_CHOICES = [
        ("Section", "Section"),
        ("Department", "Department"),
    ]

    STATIC_HERO_IMAGES = {
        "arts": "join/media/arts.webp",
        "audience": "join/media/audience.webp",
        "audio": "join/media/audio.webp",
        "copy": "join/media/copy.webp",
        "culture": "join/media/culture.webp",
        "digital": "join/media/digital.webp",
        "graphics": "join/media/graphics.webp",
        "news": "join/media/news.webp",
        "opinion": "join/media/opinion.webp",
        "photography": "join/media/photography.webp",
        "print": "join/media/print.webp",
        "sports": "join/media/sports.webp",
        "systems": "join/media/sytems.webp",
        "video": "join/media/video.webp",
    }

    template = "join/join_unit_page.html"
    parent_page_types = ["join.JoinLandingPage"]
    subpage_types: list[str] = []

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default=CATEGORY_REPORTAGE,
    )
    unit_type = models.CharField(
        max_length=20,
        choices=UNIT_TYPE_CHOICES,
        default="Section",
    )
    card_description = models.TextField(
        help_text="Short description shown on the /join/ unit card.",
    )
    hero_image = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    introduction = RichTextField(
        features=["bold", "italic", "link", "ol", "ul"],
    )
    unit_email = models.EmailField(blank=True)
    contact_role = models.CharField(max_length=120, blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    contact_email = models.EmailField(blank=True)

    content_panels = Page.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("category"),
                FieldPanel("unit_type"),
                FieldPanel("card_description"),
            ],
            heading="Landing card",
        ),
        MultiFieldPanel(
            [
                FieldPanel("hero_image"),
                FieldPanel("introduction"),
            ],
            heading="Unit introduction",
        ),
        InlinePanel("positions", label="Position"),
        MultiFieldPanel(
            [
                FieldPanel("unit_email"),
                FieldPanel("contact_role"),
                FieldPanel("contact_name"),
                FieldPanel("contact_email"),
            ],
            heading="Contact",
        ),
    ]

    @property
    def is_accepting_applications(self):
        if not self.application_form_url:
            return False
        prefetched = getattr(self, "_prefetched_objects_cache", {}).get("positions")
        positions = prefetched if prefetched is not None else self.positions.all()
        return any(position.accepting_applications for position in positions)

    @property
    def application_form_url(self):
        landing = getattr(self, "_join_landing", None)
        if landing is None:
            landing = self.get_parent().specific
        return (landing.application_form_url or "").strip()

    @property
    def static_hero_image(self):
        """Return the bundled design asset when no Wagtail image is selected."""
        return self.STATIC_HERO_IMAGES.get(self.slug, "")

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        join_landing = self.get_parent().specific
        self._join_landing = join_landing
        context["join_landing"] = join_landing
        return context


class JoinPosition(Orderable):
    page = ParentalKey(
        JoinUnitPage,
        related_name="positions",
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=180)
    description = RichTextField(
        features=["bold", "italic", "link", "ol", "ul"],
    )
    accepting_applications = models.BooleanField(
        default=False,
        help_text=(
            "Show this position as open when the shared application form URL "
            "on the main Join page is also populated."
        ),
    )

    panels = [
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("accepting_applications"),
    ]

    @property
    def is_accepting_applications(self):
        return bool(self.accepting_applications and self.resolved_application_url)

    @property
    def resolved_application_url(self):
        if not self.accepting_applications:
            return ""
        return self.page.application_form_url

    def __str__(self):
        return self.title
