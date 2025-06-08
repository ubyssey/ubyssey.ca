from wagtail import blocks
from wagtail.blocks import field_block
from wagtail.models import Page
from article.models import ArticlePage
from taggit.models import Tag
from django.utils.safestring import mark_safe
from django.utils import timezone
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

class MidStreamListTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('section/objects/promo_glm.html', 'GIRLS LOWERMAINLAND PROMO'),
        ('section/objects/section_bulleted.html', 'Default'),
        ('section/objects/section_timeline.html', 'Timeline'),
        ('section/objects/section_horizontal.html', 'Horizontal'),
        ('section/objects/section_horizontal-wrapped.html', 'Horizontal wrapped'),
        ('section/objects/section_landing.html', 'Landing'),
        ('section/objects/featured_with_wrapped_articles.html', 'Featured article with wrapped articles below'),
        ('section/objects/featured_top_headline_with_wrapped_articles.html', 'Top headline article, articles underneath'),
        ('section/objects/section_one-large-two-small.html', 'One large, two small'),
        ('section/objects/minimal_grid.html', 'Minimal grid'),
        ('section/objects/blurb_with_timeline.html', 'Blurb with timeline'),
        ('section/objects/single_promo.html', 'Single (promo)'),
        ('section/objects/single_top-headline.html', 'Single (top headline)'),
        ('section/objects/single_top-headline_timeline.html', 'Single (top headline with timeline)'),
    ]

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

class ArticleGathererBlock(AbstractArticleList):
    title = blocks.CharBlock(
        required=False,
        max_length=255,
        help_text="Fill in to overwrite title"
        )
    description = blocks.RichTextBlock(
        required=False,
        help_text="Fill in to overwrite description"
        )
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage',
        required=False
        )
    category = field_block.PageChooserBlock(
        page_type='section.CategoryPage',
        required=False
        )
    tag_slug = field_block.CharBlock(
        help_text="Enter tag slug. For example for 'Christmas Movie' the slug would be 'christmas-movie'.",
        required=False
        )
    template = MidStreamListTemplates()
    hide_mobile = field_block.BooleanBlock(
        required=False,
        help_text="If checked, will hide on small devices",
        default=False
        )
    highlight_colour = blocks.CharBlock(
        required=False,
        default='0071c9',
        max_length=6,
        help_text="Only applicable to some templates"
        )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        if value['section']:
            context['gather_title'] = value['section'].title
            context['description'] = value['section'].description
            context['link'] = value['section'].url
            context['expectedSection'] = value['section'].slug
            context['articles'] = ArticlePage.objects.child_of(value['section']).order_by('-first_published_at').live()
        else:
            context['articles'] = ArticlePage.objects.live().public().exclude(current_section = "pages").order_by('-first_published_at')

        if value['category']:
            context['gather_title'] = value['category'].title
            context['description'] = value['category'].description
            context['link'] = value['category'].url
            context['expectedSection'] = value['category'].get_parent().slug
            context['articles'] = context['articles'].filter(category_page=value['category'])

        if value['tag_slug']:
            if Tag.objects.filter(slug=value['tag_slug']).exists():
                tag = Tag.objects.get(slug=value['tag_slug'])
                context['gather_title'] = tag.name
                if value['section']:
                    context['description'] = "Stories on '" + tag.name + "' in " + value['section'].title
                else:
                    context['description'] = None
                context['link'] = '/topic/' + value['tag_slug'] + '/'
                context['articles'] = context['articles'].filter(topics__slug=value["tag_slug"])
            else:
                context['articles'] = []

        if not 'gather_title' in context:
            context['gather_title'] = "Latest stories"

        if value["title"]:
            context['title'] = value["title"]
        else:
            context['title'] = context['gather_title']

        if value["description"]:
            context['description'] = value["description"]

        if value["highlight_colour"]:
            context['highlight_colour'] = value["highlight_colour"]

        limit = 9
        if 'section/objects/section_horizontal' in value['template']:        
            limit = 5

        elif 'section/objects/featured_with_wrapped_articles.html' in value['template']:
            limit = 5

        elif 'section/objects/featured_top_headline_with_wrapped_articles.html' in value['template']:
            limit = 5

        elif 'section/objects/minimal_grid.html' in value['template']:        
            limit = 6

        context['articles'] = context['articles'][:limit]

        if len(context['articles']) > 0:
            context['self']['article'] = context['articles'][0]
        
        return context
    
class SectionBlock(AbstractArticleList):
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage',
        required=True
        )
    template = blocks.ChoiceBlock(
        choices=[
            ('section/objects/section_one-large-two-small.html', 'One left, two right'),
            ('section/objects/section_article-row.html', 'Four articles in a row'),
            ('section/objects/section_article-row--cluster.html', 'Articles clustered into by topic'),
        ]
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['section'].title
        context['link'] = value['section'].url
        context['expectedSection'] = value['section'].slug
        context['articles'] = ArticlePage.objects.child_of(value['section']).order_by('-first_published_at').live()

        limit = 9
        if 'section/objects/section_one-large-two-small.html' in value['template']:
            limit = 3
        if 'section/objects/section_article-row.html' in value['template']:
            limit = 4

        context['articles'] = context['articles'][:limit]

        if len(context['articles']) > 0:
            context['self']['article'] = context['articles'][0]
        
        return context
    
class SingleCategorySectionRowBlock(AbstractArticleList):
    template = blocks.ChoiceBlock(choices=[
                    ('section/objects/section_row_block.html', 'Grouped by categories'),
                ])
    category = blocks.PageChooserBlock("section.CategoryPage")

    show_bylines = blocks.BooleanBlock(required=False)
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["title"] = value["category"].title
        context["link"] = value["category"].url

        exclude = []
        if "exclude" in parent_context:
            exclude = parent_context["exclude"]

        if "section" in parent_context:
            articles = ArticlePage.objects.live().descendant_of(parent_context["section"]).filter(category_page = value["category"]).order_by('-first_published_at')[:6]
        else:
            articles = ArticlePage.objects.live().filter(category_page = value["category"]).order_by('-first_published_at')[:6]
        
        context["articles"] = []
        for article in articles:
            if article not in exclude:
                context["articles"].append(article)
            if len(context["articles"]) >= 3:
                break

        return context
    
class MultiCategorySectionRowBlock(AbstractArticleList):
    template = blocks.ChoiceBlock(choices=[
                    ('section/objects/section_row_block.html', 'Grouped by categories'),
                ])

    title = blocks.CharBlock(required=True)

    categories = blocks.ListBlock(blocks.PageChooserBlock("section.CategoryPage"))

    show_bylines = blocks.BooleanBlock(required=False)
    
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["title"] = value["title"]
        context["articles"] = []

        exclude = []
        if "exclude" in parent_context:
            exclude = parent_context["exclude"]

        for category in value["categories"]:
            if "section" in parent_context:
                category_articles = \
                    list(ArticlePage.objects.live().descendant_of(parent_context["section"]).filter(category_page = category).order_by('-first_published_at')[:4])
            else:
                category_articles = \
                    list(ArticlePage.objects.live().filter(category_page = category).order_by('-first_published_at')[:4])
                
            for article in category_articles:
                if article not in exclude:
                    context["articles"].append(article)
                    break

        return context

class SectionCategorizedBlock(AbstractArticleList):
    section = field_block.PageChooserBlock(
        page_type='section.SectionPage',
        required=True
        )

    fill_topic = blocks.CharBlock(required=False)

    columns = blocks.StreamBlock(
        [
            ('single_category', SingleCategorySectionRowBlock()),
            ('multi_category', MultiCategorySectionRowBlock())
        ],
        required=False
    )

    template = blocks.ChoiceBlock(
        choices=[
            ('section/objects/section_article-row--categorized.html', 'Grouped by categories'),
        ]
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['section'].title
        context['link'] = value['section'].url
        context['expectedSection'] = value['section'].slug

        exclude = []
        if "exclude" in parent_context:
            exclude = parent_context["exclude"]
        
        context['articles'] = ArticlePage.objects.live().child_of(value['section']).exclude(page_ptr_id__in=exclude).order_by('-first_published_at')
        if value["fill_topic"]:
            context['articles'] = context['articles'].filter(topics__slug=value["fill_topic"])

        limit = 4

        context['articles'] = context['articles'][:limit-len(value["columns"])]
        
        return context

class MidStreamDoubleListTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('section/objects/elections_race_timeline_with_candidates.html', 'Default'),
    ]
 
class ArticleGathererWithPinnedBlock(ArticleGathererBlock):
    template = MidStreamDoubleListTemplates()

    pinned_title = blocks.CharBlock(
        required=False,
        max_length=255,
        help_text="Fill in to overwrite title"
        )

    pinned = blocks.ListBlock(
        field_block.PageChooserBlock(
            page_type='article.ArticlePage'
        ),
        required=False,
    )
    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        if value['pinned_title']:
            context['pinned_title'] = value['pinned_title']
        context["pinned"] = [article for article in value['pinned']]
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
    description = blocks.RichTextBlock(required=False)
    link = blocks.URLBlock(required=False)
    template = MidStreamListTemplates()
    articles = blocks.ListBlock(
        field_block.PageChooserBlock(
            page_type='article.ArticlePage'
        ),
        required=False,
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


class AbstractArticleGroup(TemplateSelectStructBlock):

    template = blocks.ChoiceBlock(
        choices=[
            ('infinitefeed/sidebar/sidebar_section_block.html', 'default'),
        ]
    )

    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context)
        context["link"] = ""
        context["article_groups"] = []
        return context

class MidStreamGroupedArticlesTemplates(blocks.ChoiceBlock):
 
    choices=[
        ('section/objects/grouped_articles_timeline.html', 'Timeline'),
    ]


class ManualArticleLinkGroup(AbstractArticleGroup):
    title = blocks.CharBlock(
        required=False,
        max_length=255,
        )
    description = blocks.RichTextBlock(required=False)
    link = blocks.URLBlock(required=False)
    template = MidStreamGroupedArticlesTemplates()
    highlight_colour = blocks.CharBlock(
        required=False,
        default='0071c9',
        max_length=6,
        help_text="Only applicable to some templates"
        )
    hide_mobile = field_block.BooleanBlock(
        required=False,
        help_text="If checked, will hide on small devices",
        default=False
        )

    article_groups = blocks.ListBlock(
        blocks.StructBlock([
            ('title', blocks.CharBlock()),
            ('description', blocks.CharBlock()),
            ('articles', blocks.ListBlock(
                blocks.StructBlock([
                    ('alias', blocks.CharBlock(required=False)),
                    ('article', field_block.PageChooserBlock(page_type='article.ArticlePage', required=False)),
                    ('link', blocks.URLBlock(required=False, help_text="Only use when linking to something outside of site!")),
                ])
            ))
        ])
    )


    def get_context(self, value, parent_context=None):
        context = super().get_context(value, parent_context=parent_context)
        context['title'] = value['title']
        context['description'] = value['description']
        context['link'] = value['link']
        
        for group_block in value['article_groups']:
            group = {}
            group["title"] = group_block["title"]
            group["description"] = group_block["description"]
            group["articles"] = [article for article in group_block["articles"]]
            context['article_groups'].append(group)

        return context