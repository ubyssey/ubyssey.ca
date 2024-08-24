"""
Blocks used on the home page of the site
"""
from article.models import ArticlePage

from django.db.models import Q

from wagtail import blocks
from wagtail.blocks import field_block
from infinitefeed.blocks import AbstractArticleList

from taggit.models import Tag
from wagtail.snippets.blocks import SnippetChooserBlock

class HomepageFeaturedSectionBlock(blocks.StructBlock):

    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )

    layout = blocks.ChoiceBlock(
        choices=[
            ('bulleted', '\"Bulleted Section" Style'),
            ('featured', '\"Featured Section\" Style'),
        ],
        default='bulleted',
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

class LinksStreamBlock(blocks.StructBlock):

    links = blocks.ListBlock(
        blocks.StructBlock(
            [
                ('title', blocks.CharBlock(
                    required=True,
                    max_length=255,
                )),
                ('url',blocks.URLBlock(required=False)),
                ('description', blocks.TextBlock(required=False)),
            ],
        )
    )

    def get_context(self, value, parent_context=None):
        from events.models import Event
        from django.utils import timezone
        from datetime import timedelta
        context = super().get_context(value, parent_context)
        context['events'] = Event.objects.filter(hidden=False, end_time__gte=timezone.now()).exclude(category='seminar').order_by("start_time")[:5]

        today = timezone.now().astimezone(timezone.get_current_timezone())
        for i in range(len(context['events'])):
            
            if context['events'][i].start_time < today:
                pubdate = context['events'][i].end_time.astimezone(timezone.get_current_timezone())
                display = "Ends "
            else:
                pubdate = context['events'][i].start_time.astimezone(timezone.get_current_timezone())
                display = ""
                
            delta = abs(today - pubdate)

            day = ""
            if pubdate.date() == today.date():
                day = "Today"
            elif (pubdate - timedelta(days=1)).date() == today.date():
                day = "Tomorrow"
            elif delta.total_seconds() < timedelta(days=6).total_seconds():
                day = pubdate.strftime("%a")
            else:
                day = pubdate.strftime("%B %-d") + ","

            time = pubdate.strftime("%-I")
            if pubdate.strftime("%M") != "00":
                time = time + pubdate.strftime(":%M")
            time = time + pubdate.strftime("%P")

            display = display + day + " " + time
            
            context['events'][i].display_time = display

            context['events'][i].title = context['events'][i].title.replace("<br>", "")

        return context

    class Meta:
        template = "home/stream_blocks/links.html"

class MidStreamListTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('section/objects/section_bulleted.html', 'Default'),
        ('section/objects/section_timeline.html', 'Timeline'),
    ]

class SectionBlock(AbstractArticleList):
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )
    template = MidStreamListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['section'].title
        context['link'] = value['section'].url
        context['articles'] = value['section'].get_featured_articles(number_featured=9)          
        return context
    
class TagBlock(AbstractArticleList):
    tag_slug = field_block.CharBlock(help_text="Enter tag slug. For example for 'Christmas Movie' the slug would be 'christmas-movie'.")
    template = MidStreamListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        if Tag.objects.filter(slug=value['tag_slug']).exists():
            tag = Tag.objects.get(slug=value['tag_slug'])
            context['title'] = tag.name
            context['link'] = '/tag/' + value['tag_slug']
            context['articles'] = ArticlePage.objects.live().public().order_by('-first_published_at').filter(tags__slug=value["tag_slug"])[:9]
        return context
    
class CategoryBlock(AbstractArticleList):
    category = SnippetChooserBlock('section.CategorySnippet')

    template = MidStreamListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['category'].title
        context['link'] = value['category'].section_page.url + "category/" + value['category'].slug
        context['articles'] = ArticlePage.objects.live().public().filter(category=value['category']).order_by('-first_published_at')[:9]
        return context