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
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock

from wagtailmenus.models import FlatMenu

class SpecialLandingPage(SectionablePage, UbysseyMenuMixin):
    """
    This is the general model for "special features" landing pages, such as for the guide, or a magazine.

    Pages can select them to automatically create
    """
    #-----Layout stuff-----
    # template = "specialfeaturelanding/base.html"
    # template = "specialfeaturelanding/landing_page_guide_2022_style.html"

    use_default_template = models.BooleanField(default=True)

    category = models.ForeignKey(
        "section.CategorySnippet",
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

    def get_template(self, request):
        if not self.use_default_template:
            if self.db_template:
                return self.db_template.name

        if self.layout == 'default':
            return "specialfeaturelanding/base.html"
        elif self.layout == 'guide-2020':
            return "ubyssey/templates/guide/2020/index.html"
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
        return "specialfeaturelanding/base.html"

    parent_page_types = [
        'section.SectionPage',
        'specialfeaturelanding.SpecialLandingPage',
    ]

    subpage_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'article.ArticlePage',
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
                FieldPanel("category"),
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
                            ('guidee-2020', 'Guide (2020 style)'),
                            ('guide-2022', 'Guide (2022 style)'),
                            ('mag-2023', 'Magazine (2023 style)'),
                            ('guide-2023', 'Guide (2023 style)'),
                            ('mag-2024', 'Magazine (2024 style)'),
                            ('spoof-2024', 'Spoof (2024 style)'),
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
            ],
            heading="Meta Image",
        ),
    ]


    def get_context(self, request, *args, **kwargs):        
        context = super().get_context(request, *args, **kwargs)
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
