from wagtail.core import blocks
from wagtail.core.blocks import field_block
from wagtail.core.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock

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
        template = "infinitefeed/sidebar/sidebar_section_block.html"

class SidebarImageLinkBlock(blocks.StructBlock):
    image = ImageChooserBlock(required=True)
    link = blocks.URLBlock(required=False)
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



sidebar_stream = StreamField(
    [
        ("sidebar_advertisement_block", SidebarAdvertisementBlock()),
        ("sidebar_issues_block", SidebarIssuesBlock()),
        ("sidebar_section_block", SidebarSectionBlock()),         
        ("sidebar_flex_stream_block", SidebarFlexStreamBlock()),         
    ],
    null=True,
    blank=True,
)
