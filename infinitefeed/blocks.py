from wagtail import blocks
from wagtail.blocks import field_block
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock
from wagtail.snippets.blocks import SnippetChooserBlock
from article.models import ArticlePage
from django.db.models import Q
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

class TemplateSelectStructBlock(blocks.StructBlock):
    template = blocks.ChoiceBlock(
        choices=[
            ('infinitefeed/sidebar/sidebar_section_block.html', 'default'),
        ],
        required=True,
    )

    def render(self, value, context=None):
        """
        According to the below stackoverflow, we need to modify this specific method in order to allow template selection
        in such a way that the block itself tracks
        https://stackoverflow.com/questions/55875597/wagtail-how-to-access-structblock-class-attribute-inside-block

        In some ways this is a proof of concept for modifiable blocks
        """

        # Rather than the "normal" template logic, we look at our self.template variable
        block_template = value.get('template')
        if block_template != '':
            template = block_template
        else:
            return self.render_basic(value, context=context) # Wagtail's default for when 

        # Below this point, this render() is identical to its original counterpart
        if context is None:
            new_context = self.get_context(value)
        else:
            new_context = self.get_context(value, parent_context=dict(context))

        return mark_safe(render_to_string(template, new_context))


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

class AbstractArticleList(TemplateSelectStructBlock):

    template = blocks.ChoiceBlock(
        choices=[
            ('infinitefeed/sidebar/sidebar_section_block.html', 'default'),
        ]
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["link"] = ""
        context["articles"] = []
        return context

class SideBarListTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('infinitefeed/sidebar/sidebar_section_block.html', 'Default'),
        ('infinitefeed/sidebar/sidebar_latest_block.html', 'Latest')
    ]

class SidebarSectionBlock(AbstractArticleList):
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )

    template = SideBarListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['section'].title
        context['link'] = value['section'].url
        context['articles'] = value['section'].get_featured_articles()          
        return context

class SidebarCategoryBlock(AbstractArticleList):
    category = SnippetChooserBlock('section.CategorySnippet')

    template = SideBarListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['category'].title
        context['link'] = value['category'].section_page.url + "category/" + value['category'].slug
        context['articles'] = ArticlePage.objects.live().public().filter(category=value['category']).order_by('-explicit_published_at')[:6]
        return context

class SidebarLatestBlock(AbstractArticleList):

    title = blocks.CharBlock(
        required=True,
        max_length=255,
    )

    template = SideBarListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value["title"]
        context['articles'] = ArticlePage.objects.live().public().order_by('-first_published_at')[:5]         
        return context

class SidebarManualArticles(AbstractArticleList):
    title = blocks.CharBlock(
        required=True,
        max_length=255,
    )

    template = SideBarListTemplates()

    articles = blocks.ListBlock(blocks.PageChooserBlock(target_model=ArticlePage))

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value["title"]
        context['articles'] = value["articles"]
        return context

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