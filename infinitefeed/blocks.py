from django.db.models import Q
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from wagtail import blocks
from wagtail.blocks import field_block
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock
from wagtail.snippets.blocks import SnippetChooserBlock

from article.models import ArticlePage


class SidebarAdvertisementBlock(blocks.StructBlock):
    # Inserts of the recurring ad pattern for home page side bar
    # Use in conjunction with specify_homepage_sidebar_ads to cause a specific ad to be placed in the divs provided by this block
    class Meta:
        template = "infinitefeed/sidebar/sidebar_advertisement_block.html"


class SinglePrintIssueBlock(blocks.StructBlock):
    date = blocks.DateBlock(required=True)
    image = ImageChooserBlock(required=False)
    show_image = blocks.BooleanBlock(required=False)
    link = blocks.URLBlock(required=True)

    class Meta:
        template = "infinitefeed/sidebar/sidebar_single_issue_block.html"
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
        template = "infinitefeed/sidebar/sidebar_issues_block.html"
        verbose_name = "Sidebar Print Issues Block"
        verbose_name_plural = "Sidebar Print Issues Blocks"


class SideBarListTemplates(blocks.ChoiceBlock):
    choices = [
        ("infinitefeed/sidebar/sidebar_section_block.html", "Default"),
        ("infinitefeed/sidebar/sidebar_latest_block.html", "Latest"),
    ]


class SidebarImageLinkBlock(blocks.StructBlock):
    image = ImageChooserBlock(required=True)
    link = blocks.URLBlock(required=False)
    alt_text = blocks.CharBlock(
        max_length=255,
        help_text=(
            "For accessibility to screen reader users, enter a description of this"
            " image. Included any relevant text inside the image."
        ),
    )

    class Meta:
        template = "infinitefeed/sidebar/sidebar_image_link_block.html"
        verbose_name = "Sidebar Image with Optional Link"
        verbose_name_plural = "Sidebar Images with Optional Link"


class SidebarFlexStream(blocks.StreamBlock):
    """
    Stream to be used by various things, similar to SidebarIssuesBlock except more "miscellaneous"
    """

    image_link = SidebarImageLinkBlock()


class SidebarFlexStreamBlock(blocks.StructBlock):
    title = blocks.CharBlock(
        required=True,
        max_length=255,
    )

    stream = SidebarFlexStream()

    class Meta:
        template = "infinitefeed/sidebar/sidebar_flex_stream_block.html"
        verbose_name = "Sidebar Stream Flex Block"
        verbose_name_plural = "Sidebar Stream Flex Blocks"
