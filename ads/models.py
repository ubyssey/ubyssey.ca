from django.db import models
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from wagtail.admin.edit_handlers import TabbedInterface, ObjectList, MultiFieldPanel, HelpPanel, InlinePanel
from wagtail.core.models import Orderable
from wagtail.contrib.settings.models import BaseSetting, register_setting
from wagtailmodelchooser import register_model_chooser
from wagtailmodelchooser.edit_handlers import ModelChooserPanel

@register_model_chooser
class AdSlot(models.Model):
    """
    About:
        Definition of "ad slot" according to Google Ad Manager glossary:

            "An ad slot is the HTML markup (usually between <div> tags) the defines where an ad appears.
            Ad slots can reference either unique ad units or, if on a single page, ad slots can also reference the same ad unit."

        (from https://support.google.com/admanager/table/7636513?hl=en, accessed 2022/05/26)

        This class models the data that distinguishes different ad slots in the HTML.
        It works with the template tag "adslot" to insert these HTML elements into templates.

        The relevant divs for displaying ads will be selected by the class, which
        should be a fixed part of the template used to render this information.
        This, unlike the rest of the attributes used to construct the relevant div
        should NOT having a corresponding field in this model, because it is constant and not variable.
        
        To use an ad slot to display an ad, use the Google Publisher Tag library to call googletag.defineSlot
        https://developers.google.com/publisher-tag/reference#googletag.defineSlot 

    Attributes:
        slug: identifies entry in table
        size: str - dfp.js keeps a dictionary of standard ad sizes. The possible choices for this field represent the keys for that dictionary.
        div_id: str - "id" in the sense of an HTML attribute. 
        dfp: str - Corresponds to the ad unit on the Google Ad Manager side of things.
        template: template used to render this information. Only one such template exists by default. 
    """
    slug = models.SlugField(null=False, blank=False, unique=True)
    div_id = models.CharField(null=False, blank=True, default='', max_length=255, verbose_name="HTML Element ID")
    size = models.CharField(null=False, blank=False, default='box', max_length=255,
        choices=[
            ('box','Box'),
            ('skyscraper', 'SkyScraper'),
            ('banner','Banner'),
            ('leaderboard',"Leaderboard"),
            ('mobile-leaderboard',"Mobile Leaderboard"),
        ],
    )
    dfp = models.CharField(null=False, blank=True, default='', max_length=255, verbose_name="Ad Unit Name (AKA \"DFP\")")
    div_class = models.CharField(null=False, blank=True, default='box', max_length=255,
        choices=[
            ('','Default'),
            ('homepage', 'Homepage'),
            ('mobile-frontpage-box', 'Mobile Frontpage Box'),            
        ],
    )

    def __str__(self) -> str:
        return self.slug

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['slug']),
        ]

@register_setting(icon='cogs')
class AdTagSettings(ClusterableModel, BaseSetting):
    # There should be one of these per (major) page type:
    # Home Page, Section Page, Article Page
    home_ad_panels = [
        MultiFieldPanel(
            [
                HelpPanel(content='This is where the explanation on how to add Google Ad Manager ads to our website go.\nThere are two tags per ad slot: a "head" tag which communicates with Google, and a "placement" tag')
            ],
            heading="How to add Google Ad Manager ads to the site"
        ),
        MultiFieldPanel(
            [
                InlinePanel("home_head_tags", label="Home page ad head tags"),
            ],
            heading="Head Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("home_header_placements", label="Home header banner/leaderboard placement tags"),
            ],
            heading="Header Placement Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("home_sidebar_placements", label="Home sidebar placement tags"),
            ],
            heading="Sidebar Placement Tags"
        ),
    ]
    section_ad_panels = [
        MultiFieldPanel(
            [
                HelpPanel(content='This is where the explanation on how to add Google Ad Manager ads to our website go.\nThere are two tags per ad slot: a "head" tag which communicates with Google, and a "placement" tag')
            ],
            heading="How to add Google Ad Manager ads to the site"
        ),
        MultiFieldPanel(
            [
                InlinePanel("section_head_tags", label="Section page ad head tags"),
            ],
            heading="Head Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("section_header_placements", label="Section header banner/leaderboard placement tags"),
            ],
            heading="Header Placement Tags"
        ),
        # MultiFieldPanel(
        #     [
        #         InlinePanel("section_sidebar_placements", label="Section sidebar placement tags"),
        #     ],
        #     heading="Sidebar Placement Tags"
        # ),
    ]
    article_ad_panels = [
        MultiFieldPanel(
            [
                HelpPanel(content='This is where the explanation on how to add Google Ad Manager ads to our website go.\nThere are two tags per ad slot: a "head" tag which communicates with Google, and a "placement" tag')
            ],
            heading="How to add Google Ad Manager ads to the site"
        ),
        MultiFieldPanel(
            [
                InlinePanel("article_head_tags", label="Article page ad head tags"),
            ],
            heading="Head Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("article_header_placements", label="Article header banner/leaderboard placement tags"),
            ],
            heading="Header Placement Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("article_sidebar_placements", label="Article sidebar placement tags"),
            ],
            heading="Sidebar Placement Tags"
        ),
        MultiFieldPanel(
            [
                InlinePanel("article_inline_placements", label="Article inline placement tags"),
            ],
            heading="Inline Placement Tags"
        ),
    ]

    edit_handler = TabbedInterface([
        ObjectList(home_ad_panels, heading='Home Page Ads'),
        ObjectList(section_ad_panels, heading='Section Page Ads'),
        ObjectList(article_ad_panels, heading='Article Page Ads'),
    ])

    class Meta:
        verbose_name = "Ad Settings"
        verbose_name_plural = "Instances of \'Ad Settings\'"

class AdHeadOrderable(Orderable):
    ad_slot = models.ForeignKey(
        AdSlot,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name='+',
        verbose_name="Ad Slot"
    )

    panels = [
        ModelChooserPanel('ad_slot'),
    ]

class AdPlacementOrderable(Orderable):
    ad_slot = models.ForeignKey(
        AdSlot,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name='+',
        verbose_name="Ad Slot"
    )

    panels = [
        ModelChooserPanel('ad_slot'),
    ]

class HomeAdHeadOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='home_head_tags')

class HomeHeaderPlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='home_header_placements')

class HomeSidebarPlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='home_sidebar_placements')

class SectionAdHeadOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='section_head_tags')

class SectionHeaderPlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='section_header_placements')

class ArticleAdHeadOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='article_head_tags')

class ArticleHeaderPlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='article_header_placements')

class ArticleSidebarPlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='article_sidebar_placements')

class ArticleInlinePlacementOrderable(AdPlacementOrderable):
    settings = ParentalKey(AdTagSettings,related_name='article_inline_placements')
