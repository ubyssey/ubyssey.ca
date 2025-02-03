"""
Blocks used on the home page of the site
"""
from article.models import ArticlePage

from django.db.models import Q

from wagtail import blocks
from wagtail.models import Page
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
        events = Event.objects.filter(hidden=False, end_time__gte=timezone.now()).exclude(category='seminar').order_by("start_time")[:15]
        context["ongoing"] = []
        context["upcoming"] = []
        today = timezone.now().astimezone(timezone.get_current_timezone())
        for i in range(len(events)):
            
            if events[i].start_time < today:
                pubdate = events[i].end_time.astimezone(timezone.get_current_timezone())
                display = "Ends "
            else:
                if len(context["ongoing"]) + len(context["upcoming"]) > 5:
                    break
                pubdate = events[i].start_time.astimezone(timezone.get_current_timezone())
                display = ""
                
            delta = abs(today - pubdate)

            if pubdate.date() == today.date():
                day = ""
            elif (pubdate - timedelta(days=1)).date() == today.date():
                day = "Tomorrow"
            elif delta.total_seconds() < timedelta(days=6).total_seconds():
                if events[i].start_time < today:
                    day = pubdate.strftime("%A")
                else:
                    day = pubdate.strftime("%a")
            else:
                day = pubdate.strftime("%B %-d") + ","

            time = ""
            if pubdate.hour != 0 and pubdate.hour != 23:
                time = " " + pubdate.strftime("%-I")
                if pubdate.strftime("%M") != "00":
                    time = time + pubdate.strftime(":%M")
                time = time + pubdate.strftime("%P")

            display = display + day + time
            events[i].display_time = display
            events[i].title = events[i].title.replace("<br>", ", ")

            if events[i].start_time < today:
                context["ongoing"].append(events[i])
            else:
                context["upcoming"].append(events[i])
        
        context["ongoing"].sort(key=lambda e: e.end_time)
        return context

    class Meta:
        template = "home/stream_blocks/links.html"

class MidStreamListTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('section/objects/section_bulleted.html', 'Default'),
        ('section/objects/section_timeline.html', 'Timeline'),
        ('section/objects/section_horizontal.html', 'Horizontal'),
        ('section/objects/section_landing.html', 'Landing'),
        ('section/objects/minimal_grid.html', 'Minimal grid'),
        ('section/objects/single_promo.html', 'Single (promo)'),
        ('section/objects/single_top-headline.html', 'Single (top headline)'),
        ('section/objects/single_top-headline_timeline.html', 'Single (top headline with timeline)'),
    ]
    
class ArticleGathererBlock(AbstractArticleList):
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage',
        required=False
    )
    category = SnippetChooserBlock('section.CategorySnippet',
        required=False
    )
    tag_slug = field_block.CharBlock(
        help_text="Enter tag slug. For example for 'Christmas Movie' the slug would be 'christmas-movie'.",
        required=False
    )
    template = MidStreamListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        if value['section']:
            context['title'] = value['section'].title
            context['description'] = value['section'].description
            context['link'] = value['section'].url
            context['expectedSection'] = value['section'].slug
            context['articles'] = ArticlePage.objects.child_of(value['section']).order_by('-first_published_at').live()
        else:
            context['articles'] = ArticlePage.objects.live().public().order_by('-first_published_at')

        if value['tag_slug']:
            if Tag.objects.filter(slug=value['tag_slug']).exists():
                tag = Tag.objects.get(slug=value['tag_slug'])
                context['title'] = tag.name
                if value['section']:
                    context['description'] = "Stories on '" + tag.name + "' in " + value['section'].title
                else:
                    context['description'] = None
                context['link'] = '/tag/' + value['tag_slug']
                context['articles'] = context['articles'].filter(tags__slug=value["tag_slug"])

        if value['category']:
            context['title'] = value['category'].title
            context['description'] = value['category'].description
            context['link'] = value['category'].section_page.url + "category/" + value['category'].slug + "/"
            context['expectedSection'] = value['category'].section_page.slug
            context['articles'] = context['articles'].filter(category=value['category'])

        if not 'title' in context:
            context['title'] = "Latest stories"

        limit = 9
        if 'section/objects/section_horizontal.html' in value['template']:        
            limit = 4
        if 'section/objects/minimal_grid.html' in value['template']:        
            limit = 6

        context['articles'] = context['articles'][:limit]

        if len(context['articles']) > 0:
            context['self']['article'] = context['articles'][0]
        
        return context
    
class SpecialLandingPageBlock(AbstractArticleList):
    landing = field_block.PageChooserBlock(
        page_type='specialfeaturelanding.SpecialLandingPage'
    )
    template = MidStreamListTemplates()

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['landing'].title
        context['link'] = value['landing'].url
        context['articles'] = [value['landing']] + list(Page.objects.child_of(value['landing']).all())
        return context
    

class ManualArticles(AbstractArticleList):
    title = blocks.CharBlock(
        required=False,
        max_length=255,
        )
    description = blocks.TextBlock(required=False)
    link = blocks.URLBlock(required=False)
    template = MidStreamListTemplates()
    articles = blocks.ListBlock(
        field_block.PageChooserBlock(
            page_type='article.ArticlePage'
        )
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['title']
        context['description'] = value['description']
        context['link'] = value['link']
        context['articles'] = [article for article in value['articles']]

        if len(context['articles']) > 0:
            context['self']['article'] = context['articles'][0]

        return context
