"""
Blocks used on the home page of the site
"""
from ads.models import HomeSidebarPlacementOrderable
from article.models import ArticlePage

from django import forms
from django.db.models import Q
from dispatch.models import Section

from wagtail.core import blocks
from wagtail.core.blocks import field_block

from wagtail.images.blocks import ImageChooserBlock
from wagtailmodelchooser.blocks import ModelChooserBlock

class SectionChooserBlock(blocks.ChooserBlock):
    # based off code from:
    # https://groups.google.com/g/wagtail/c/S26h5GP9_Fk?pli=1
    # maybe move to a different namespace
    target_model = Section
    widget = forms.Select

class HomepageFeaturedSectionBlock(blocks.StructBlock):

    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )

    layout = blocks.ChoiceBlock(
        choices=[
            ('news', '\"News Section" Style'),
            ('featured', '\"Featured Section\" Style'),
        ],
        default='news',
        required=True,
    )

    def get_context(self, value, parent_context=None):
        # When working with a model it's often not a good idea to make a bunch of context variables like this,
        # because most values are simply attributes of the model and we can just pass the model object to the context
        # Becuase a block isn't a model, Django's templating can get confused by the relatively complex data structures involved.
        # Therefore for ease of use, we make sure the values we want to use in templates are visible in context here.

        context = super().get_context(value, parent_context=parent_context)
        context['section'] = value['section']
        context['layout'] = value['layout']
        context['articles'] = context['section'].get_featured_articles()          
        return context

    class Meta:
        template = "home/stream_blocks/section_block.html"

class AboveCutBlock(blocks.StructBlock):
    # Ideally this will be used to grant the user more control of what happens "above the cut"
    # As of 2022/05/18, all it does is expose to the user what was previously just implemented with a hardcoded "include"
    # As of 2022/05/25, adding ad block selection
    # As of 2022/06/23, selecting from settings orderable instead


    # NOTE 7/05 - DO NOT WORK AS I HOPED
    # sidebar_placement_orderable = ModelChooserBlock(
    #     target_model=HomeSidebarPlacementOrderable,
    #     required=False,
    # )
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        qs = ArticlePage.objects.live().public().filter(~(Q(current_section='guide'))).order_by('-explicit_published_at')
        context['articles'] = qs[:6]
        # context['sidebar_placement_orderable'] = value['sidebar_placement_orderable']
        return context

    class Meta:
        template = "home/stream_blocks/above_cut_block.html"

class SidebarAdvertisementBlock(blocks.StructBlock):
    # Inserts of the recurring ad pattern for home page side bar
    # Use in conjunction with specify_homepage_sidebar_ads to cause a specific ad to be placed in the divs provided by this block
    class Meta:
        template = "home/stream_blocks/sidebar_advertisement_block.html"

class SinglePrintIssueBlock(blocks.StructBlock):
    date = blocks.DateBlock(required=True)
    image = ImageChooserBlock(required=False)
    show_image = blocks.BooleanBlock(required=False)
    link = blocks.URLBlock(required=True)
    class Meta:
        template = "home/stream_blocks/sidebar_single_issue_block.html"
        verbose_name = "Print Issue"
        verbose_name_plural = "Print Issues"

class SidebarIssuesStream(blocks.StreamBlock):
    """
    Stream to be used by the SidebarIssueBlock. Each entity in the stream represents a single print issue.
    """
    issue = SinglePrintIssueBlock()

class SidebarIssuesBlock(blocks.StructBlock):
    """
    Place this on the home page to create a place for print issues to be displayed on the homepage.

    Consists of a title block (self explanatory) and a stream block (which contains the issues to be displayed)
    """
    title = blocks.CharBlock(required=True, max_length=255)
    issues = SidebarIssuesStream()
    class Meta:
        template = "home/stream_blocks/sidebar_issues_block.html"
        verbose_name = "Sidebar Print Issues Block"
        verbose_name_plural = "Sidebar Print Issues Blocks"

class SidebarSectionBlock(blocks.StructBlock):
    title = blocks.CharBlock(
        required=True,
        max_length=255,
    )
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['title']
        context['section'] = value['section']
        context['articles'] = context['section'].get_featured_articles()          
        return context
    class Meta:
        template = "home/stream_blocks/sidebar_section_block.html"
