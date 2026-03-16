import datetime
import json
from tabnanny import verbose

from images.models import GallerySnippet

from dbtemplates.models import Template as DBTemplate

from django.db import models
from django.db.models import fields, Q, Max
from django.db.models.fields import CharField
from django.shortcuts import render
from django.db.models.query import QuerySet
from django.forms.widgets import Select, Widget
from django.utils import timezone
from django_user_agents.utils import get_user_agent

from itertools import groupby
from images import blocks as image_blocks
from images.models import GallerySnippet

from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from modelcluster.contrib.taggit import ClusterTaggableManager

from section.sectionable.models import SectionablePage

from taggit.models import TaggedItemBase, TagBase, ItemBase

from videos import blocks as video_blocks
from ubyssey.validators import validate_youtube_url
from wagtail.contrib.routable_page.models import RoutablePageMixin, route
from article import blocks_inner_article as blocks_inner_article
from article import blocks_storystream

from wagtail.admin.panels import (
    # Panels
    FieldPanel,
    FieldRowPanel,
    HelpPanel,
    InlinePanel,
    MultiFieldPanel,
    # Custom admin tabs
    ObjectList,
    TabbedInterface,
    TitleFieldPanel
)
from wagtail.admin.widgets.slug import SlugInput
from wagtail.admin.filters import WagtailFilterSet
from wagtail import blocks
from wagtail.fields import StreamField, RichTextField
from wagtail.models import Page, PageManager, Orderable, RevisionMixin, PreviewableMixin
from wagtail.documents.models import Document
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.search import index
from wagtail.snippets.blocks import SnippetChooserBlock
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from wagtailmenus.models import FlatMenu


from wagtail_color_panel.fields import ColorField
from wagtail_color_panel.edit_handlers import NativeColorPanel


UBYSSEY_FOUNDING_DATE = datetime.date(1918,10,17) 

#-----Mixins-----
class UbysseyMenuMixin(models.Model):

    menu = models.ForeignKey(
        FlatMenu,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    create_menu_from_parent = models.BooleanField(
        default = False,
    )
    parent_page_for_menu_generation = models.ForeignKey(
        'specialfeaturelanding.SpecialLandingPage',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',        
    )

    menu_content_panels = [
        MultiFieldPanel(
            [
                HelpPanel('<p>If the article has a special menu, as when it belongs to a special series of articles, select the relevant menu here</p><p>Alternatively, tick the box and select a page to create a menu from</p>'),
                FieldPanel('menu'),
                FieldPanel('create_menu_from_parent'),
                FieldPanel('parent_page_for_menu_generation'),
            ],
            heading="Special Menus",
            classname="collapsible",
        ),
    ]
    class Meta:
        abstract = True

#-----Snippet Models-----

@register_snippet
class ArticleSeriesSnippet(ClusterableModel):
    title = fields.CharField(
        blank=False,
        null=False,
        max_length=200
    )
    slug = fields.SlugField(
        unique=True,
        blank=False,
        null=False,
        max_length=200
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('title'),
                FieldPanel('slug'),
            ],
            heading="Essentials"
        ),
        MultiFieldPanel(
            [
                InlinePanel("articles", label="Articles"),
            ],
            heading="articles"
        ),
    ]
    def __str__(self):
        return self.title
    class Meta:
         verbose_name = "Series of Articles"
         verbose_name_plural = "Series of Articles"


#-----Orderable models-----
class ArticleAuthorsOrderable(Orderable):
    """
    This closely corresponds to the Dispatch model that is (mis-)named "Author"
    """
    article_page = ParentalKey(
        "article.ArticlePage",
        related_name="article_authors",
    )
    author = models.ForeignKey(
        'authors.AuthorPage',
        on_delete=models.CASCADE,
        related_name="article_authors",
    )
    author_role = CharField(        
        # While stored as a CharField, will be selected from a menu. See the Widget in the panels value of this Orderable
        max_length=50,
        null=False,
        blank=True,
        default='author',
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel("author"),
                FieldPanel(
                    "author_role",
                    widget=Select(
                        choices=[
                            ('author', 'Author'), 
                            ('illustrator','Illustrator'),
                            ('photographer','Photographer'),
                            ('videographer','Videographer'),
                            ('designer','Designer'),
                            ('org_role', 'Show organization role'),
                        ],
                    ),
                ),
            ],
            heading="Author",
        ),
    ] # panels for ArticleAuthorsOrderable

class MagazineArticleBylineOrderable(Orderable):
    byline = models.TextField(blank=True, null=False, default='')
    article_page = ParentalKey(
        "article.ArticlePage",
        related_name="magazine_bylines",
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('byline'),
            ],
            heading="Byline",
            help_text="Legacy field. 'Magazine' type articles typically allowed for custom bylines, rather than using the ones ArticlePages could generate automatically. While future magazines COULD continue to use these custom bylines, this tends to create confusion and users entering lots of information that is redundant accross fields (with no formal guarantee of that redundancy, disallowing the removal of this field to recreate bylines from some single source of truth).",
        ),
    ]

class ConnectedArticleOrderable(Orderable):
    connected_article = models.ForeignKey(
        "article.ArticlePage",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    parent_article = ParentalKey(
        "article.ArticlePage",
        default='',
        related_name="connected_articles",
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel('connected_article'),
            ],
            heading="Article"
        ),
    ]


class SeriesOrderable(Orderable):
    """
    Represents a single article in a series of articles. Associated with ArticleSeriesSnippet
    """
    article = models.ForeignKey(
        "article.ArticlePage",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    series = ParentalKey(
        "ArticleSeriesSnippet",
        default='',
        related_name="articles",
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('article'),
            ],
            heading="Article"
        ),
    ]

class ArticleFeaturedMediaOrderable(Orderable):
    """
    This is based off the "ImageAttachment" class from Dispatch

    The ImageAttachment class was a bit of an oddity but it was clear that it was supposed to be an "intermediary"
    between an article and an image model in a very analogous way to Orderables, even having an apparently unused
    "Orderable" field.

    Because essentialy identical classes were used for both Images and Videos, we are here making code more DRY
    for an article
    """
    article_page = ParentalKey(
        "article.ArticlePage",
        related_name="featured_media",
    )

    caption = models.TextField(blank=True, null=False, default='')
    credit = models.TextField(blank=True, null=False, default='')
    alt_text = models.TextField(blank=True, null=False, default='',
        help_text="For accessibility to screen reader users, enter a description of this image. Included any relevant text inside the image.")
    # style = models.CharField(max_length=255, blank=True, null=False, default='')
    # width = models.CharField(max_length=255, blank=True, null=False, default='')
    image = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    video = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        default='',
        validators=[validate_youtube_url,]
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("image"),
                FieldPanel("video"),
            ],
            heading="Media Choosers",
        ),
        MultiFieldPanel(
            [
                FieldPanel("caption"),
                FieldPanel("credit"),
                FieldPanel("alt_text"),
            ],
            heading="Caption/Credits",
        ),
    ]

class ArticleStyleOrderable(Orderable):
    css = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='+',
    )
    article_page = ParentalKey(
        "article.ArticlePage",
        related_name="styles",
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('css'),
            ],
            heading="CSS Document"
        ),
    ]

class ArticleScriptOrderable(Orderable):
    script = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='+',
    )
    article_page = ParentalKey(
        "article.ArticlePage",
        related_name="scripts",
    )
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('script'),
            ],
            heading="Script"
        ),
    ]

# Timeline Snippets
@register_snippet
class TimelineSnippet(models.Model):
    """
    Users select a TimelineSnippet in article admin for Article.
    Data field will automatically update whenever save() is hit.
    """

    title = fields.CharField(blank=False, null=False, max_length=200)
    slug = fields.SlugField(unique=True, blank=False, null=False, max_length=200)
    data = fields.TextField(blank=True, null=False)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel('title'),
                FieldPanel('slug'),
            ],
            heading="Essentials",
        ),
    ]

    def save(self, *args, **kwargs) -> None:
        """
        Forces update of the "data" field every time a timeline is saved.

        Should be called during the pre_save of ArticlePage when the ArticlePage happens to have a corresponding timeline.
        """
        self.update_data()
        return super().save(*args, **kwargs)
    
    def update_data(self) -> None:
        self.data = '' # Wipe our slate clean before we update. Otherwise, an article that once had articles but no longer does will end up with "leftover" data
        qs = self.timeline_articles.all().live().order_by('timeline_date')
        if len(qs) > 0:
            list_of_dictified_articles = list(qs.values('id','fw_above_cut_lede','timeline_date','slug','title','featured_media'))

            for i, dictified_article in enumerate(list_of_dictified_articles):
                try:
                    list_of_dictified_articles[i]['featured_media'] = ArticleFeaturedMediaOrderable.objects.get(id=[dictified_article['featured_media']]).image.get_rendition('fill-200x200').url
                except:
                    list_of_dictified_articles[i]['featured_media'] = ''

                try: 
                    list_of_dictified_articles[i]['timeline_date'] = dictified_article['timeline_date'].strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                except:
                    list_of_dictified_articles[i]['timeline_date'] = timezone.now.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            self.data = json.dumps(list_of_dictified_articles)
        return

    def __str__(self) -> str:
        return self.title

#-----Taggit models-----

class ArticleTopic(TagBase, PreviewableMixin, RevisionMixin):
    #free_tagging = False

    description = RichTextField(
        null=False,
        blank=True,
        default='',
        help_text = "Give an overview of the topic. Link densely to our coverage."
    )

    info_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Description Updated Date/Time",
        help_text = "Delete before saving ",
    )

    listed = models.BooleanField(
        default=False,
        help_text = "Listed topics are displayed at the end of tagged articles"
    )

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last used at",
        editable=False,
        help_text = "Stores the last time an article tagged with this topic was published",
    )

    tagged_articles_count = models.IntegerField(default=0, editable=False)

    panels = [
        FieldPanel("name"),
        FieldPanel("slug", widget=SlugInput()),
        FieldPanel("description"),
        FieldPanel("listed")
    ]
    
    def get_count_of_tagged_articles(self):
        return TaggedArticlePage.objects.filter(tag=self).count()

    def recent_sections(self):
        return ", ".join(set([tagged.content_object.current_section for tagged in TaggedArticlePage.objects.filter(tag=self).order_by("-id")[:5]]))

    def most_frequent_section(self):
        def most_common(lst):
            return max(set(lst), key=lst.count)
        return most_common([tagged.content_object.current_section for tagged in TaggedArticlePage.objects.filter(tag=self)])

    def last_tagged_at(self):
        tagged = TaggedArticlePage.objects.filter(tag=self).aggregate(Max("content_object__first_published_at"))
        print(tagged)
        if tagged == None:
            return 0
        return tagged["content_object__first_published_at__max"]
    
    def get_relative_url(self):
        return "/topic/" + self.slug + "/"

    def get_preview_context(self, request, mode_name):
        context = super().get_preview_context(request, mode_name)
        context["filters"] = {"tag": self.id}
        context["storystream"] = "true"
        return context

    def get_preview_template(self, request, mode_name):
        return "tag/tag_page.html"

    class Meta:
        verbose_name = "Article topic"
        verbose_name_plural = "Article topics"

#-----Taggit models-----
class TaggedArticlePage(ItemBase):
    """
    Reference: 
    https://docs.wagtail.io/en/stable/reference/pages/model_recipes.html
    """
    tag = models.ForeignKey(
        ArticleTopic, related_name="tagged_articles", on_delete=models.CASCADE
    )
    content_object = ParentalKey('article.ArticlePage', on_delete=models.CASCADE, related_name='tagged_articles')


class ArticlePageTag(TaggedItemBase):
    """
    Reference: 
    https://docs.wagtail.io/en/stable/reference/pages/model_recipes.html
    """
    content_object = ParentalKey('article.ArticlePage', on_delete=models.CASCADE, related_name='tagged_items')
    class Meta:
        verbose_name = "article tag"
        verbose_name_plural = "article tags"

class TagsFieldPanel(FieldPanel):
    '''
    Adds the javascript that fills the dropdown based on the contents of the tag field
    '''
    class BoundPanel(FieldPanel.BoundPanel):
        class Media:
            js = ["ubyssey/js/widgets/tags-panel.js"]    

class SuggestedBarFieldPanel(FieldPanel):
    '''
    Adds the javascript that auto-updates the choice of suggested bar when editors select a category.
    Generally we want the suggested bar to use the category if there is one and the primary topic if there isn't.
    But there might be exceptions so we want editors to have control. But editors can't be trusted to actually
    to use this control reliably. They usually just use the default settings on everything.
    So we auto update this field which technically offers editors control but does whats generally correct as defualt otherwise.
    '''
    class BoundPanel(FieldPanel.BoundPanel):
        class Media:
            js = ["ubyssey/js/widgets/auto-update-suggested-bar-choice.js"]    


class PrimaryTagSelect(Select):
    '''
    Bizzare roundabout way to add the value of the field as one of the choices.
    slightly altered method of ChoiceWidget found here: https://github.com/django/django/blob/main/django/forms/widgets.py
    '''
    def optgroups(self, name, value, attrs=None):
        # Add value of primary tag field as one of the choices
        if len(value) > 0:
            if ArticleTopic.objects.filter(slug=value[0]).exists():
                self.choices.append((value[0], ArticleTopic.objects.get(slug=value[0]).name))

        return super().optgroups(name, value, attrs)  

#-----Manager models-----
class ArticlePageManager(PageManager):

    def get_queryset(self):
        """
        Extend the default queryset to prefetch featured images for all articles.

        This significantly reduces the number of database queries on pages that list
        a large number of articles.
        """
        return super() \
            .get_queryset() \
            .prefetch_related('featured_media__image', "article_authors__author")

    def from_section(self, section_slug='', section_root=None) -> QuerySet:
        from .models import ArticlePage
        from section.models import SectionPage
        
        if section_slug:
            try:
                section_root = SectionPage.objects.get(slug=section_slug)
                articles = self.live().public().descendant_of(section_root)
            except SectionPage.DoesNotExist:
                articles = SectionPage.objects.none()
            
        return articles

#-----Page models-----

class ArticlePage(RoutablePageMixin, SectionablePage, UbysseyMenuMixin):

    #-----Django/Wagtail settings etc-----
    objects = ArticlePageManager()

    parent_page_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'section.SectionPage',
    ]

    subpage_types = [] #Prevents article pages from having child pages

    show_in_menus_default = True
    show_in_menus = True

    # Meta info
    explicit_published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Publication Date/Time",
        help_text = "Techically optional (computer will fill it in for you if you do not). Publication date which is explicitly shown to the reader. Articles are seperately date/timestamped for database use; if this field is left blank, it will by default be set to the \"first published date\" on publication.",
    )
    last_modified_at = models.DateTimeField(
        # updates to current date/time every time the model's .save() method is hit
        auto_now=True,
    )
    show_last_modified = models.BooleanField(
        default = False,
        help_text = "Check this to alert readers the article has been revised since its publication.",
    )

    class TimelinessChoices(models.IntegerChoices):
        A_DAY = 1, ("Timely for a day")
        A_FEW_DAYS = 2, ("Timely for a few days")
        A_WEEK = 3, ("Timely for a week")
        EVERGREEN = 4, ("Evergreen")

    timeliness = models.IntegerField(choices=TimelinessChoices.choices, default=TimelinessChoices.A_FEW_DAYS.value)

    lede = models.TextField(
        # Was called "snippet" in Dispatch - do not want to reuse this work, so we call it 'lede' instead
        null=False,
        blank=True,
        default='',
    )
    storystream_view = StreamField(
        blocks_storystream.StoryStreamBlockTypes,
        blank = False,
        use_json_field=True,
        min_num = 1,
        max_num = 1,
    )

    #-----Category and Tag stuff-----
    category_page = models.ForeignKey(
        "section.CategoryPage",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        help_text="Categories are created for subsections, columns, supplements, and special issues."
    )
    topics = ClusterTaggableManager(
        through='article.TaggedArticlePage', 
        blank=True, 
        related_name='topics', 
        help_text="ADD 'Top stories' IF YOU WANT IT TO GO ON TOP STORIES LIST.",
        verbose_name="Topics")
    
    primary_tag_slug = models.CharField(
        null=True,
        blank=True,
        default='',
        max_length=255,
        help_text="The primary topic can be used for listing articles in the suggested bar at the end. It is also used to gather related articles to be presented on some section pages.",
        verbose_name="Primary Topic",
    )
    tag_page_link = models.BooleanField(
        null=False,
        blank=False,
        default=False,
        help_text="Check this if you want to add a link to the primary topic page at the end of the article.",
        verbose_name="Link to Primary Topic at the End of the Article"
    )
    filter_by_tags = models.BooleanField(
        null=False,
        blank=False,
        default=True,
        help_text="This determines what articles will be listed in the suggested bar at the end of the article.",
        verbose_name="Suggested Bar"
    )

    # template #TODO

    #-----Promote panel stuff------
    is_breaking = models.BooleanField(
        null=False,
        blank=False,
        default=False,
        verbose_name="Breaking News?",
    )
    breaking_timeout = models.DateTimeField(
        # Note: should appear on interface contingent on "is breaking" being checked. Defaults are to ensure functionality prior to implementing this
        null=False,
        blank=False,
        default=timezone.now,
    )
    seo_keyword = models.CharField(
        max_length=100, 
        null=False, 
        blank=True, 
        default='',
        verbose_name="SEO Keyword",
    ) # AKA "Focus Keywords" in the old Dispatch frontend
    seo_description = models.TextField(
        null=False,
        blank=True,
        default='',
        verbose_name="SEO Description",
    ) # AKA "Meta Description" in the old Dispatch frontend
    noindex = models.BooleanField(
        null=False,
        blank=False,
        default=False,
        verbose_name="Add 'noindex' tag?",
        help_text="Warning: Only to be used when an article is requested to be unpublished, as per unpublishing policy. Should be FALSE in all but exceptional circumstances!",
    )
    #-----Setting panel stuff-----
    is_explicit = models.BooleanField(
        default=False,
        verbose_name="Is Explicit?",
        help_text = "Check if this article contains advertiser-unfriendly content. Disables ads for this specific article."
    )

    title_tag = models.CharField(
        null=False,
        blank=True,
        default='',
        verbose_name='Title Tag (Optional)',
        help_text="This appears above the title. It mimics the title tags in the print issue.",
        max_length=255,
    )
    
    #-----For Wagtail's user interface-----
    content_panels = Page.content_panels + [
        FieldRowPanel(
            [
                FieldPanel("explicit_published_at"),
                FieldPanel("show_last_modified"),
            ],
            heading="Publication Date",
        ),
        MultiFieldPanel(
            [
                FieldPanel('title_tag'),
                InlinePanel("featured_media", label="Featured Image or Video"),
            ],
            heading = "Header/Banner Fields",
            classname="collapsible",
        ), # Optional Header/Banner Fields
        MultiFieldPanel(
            [
                HelpPanel(content="Authors may be created by creating an \"Author Page\", then selected here."),
                InlinePanel("article_authors", min_num=1, max_num=20, label="Author"),
            ],
            heading="Author(s)",
            classname="collapsible",
        ), # Author(s)
        MultiFieldPanel(
            [
                FieldPanel("category_page"),
                HelpPanel(
                    content='''
                        <h1>About Topics</h1>
                        <p>Topics entered here will be listed in the topic page with the format <a href='https://ubyssey.ca/topic/top-stories/' target='_blank'>https://ubyssey.ca/topic/top-stories/</a>.</p>
                        <p>Do NOT think of this like tagging an instagram post. It is NOT useless metadata or for SEO. <b><u>We tag articles so that ongoing subjects and stories are easy for readers to find and follow within our website</u></b>. These readers include everyone from students studying at UBC right now, to future Ubyssey editors, and journalists covering UBC at larger publications like the CBC and the Globe and Mail. <i>(More needs to be done to make use of topics and link to topic pages on the website. I'm working on it! - Sam Low)</i></p>
                        <p>Make articles from our archive easier to find and they will be read more often. Tagging newspapers has a long history. The New York Times became known as the 'Paper of Record' because of its <a href='https://en.wikipedia.org/wiki/New_York_Times_Index' target='_blank'>New York Times Index</a> which rigoursly tagged every article of every paper by topic. This act unlocked the value of their archive and secured New York Times reporting center stage in the canon of history.</p>
                        <h2>Tips for topics</h2>
                        <ol>
                            <li>1. Consistency is very important. Use the full name with correct capitalization every time.</li>
                            <li>2. Tag the full name of every subject of the article. Subjects can include individuals, organizations, buildings, exhibits, concepts, etc.</li>
                            <li>3. Add tags at all levels of specificity. For example 'AMS', 'AMS Candidate Profile'  'AMS elections', 'AMS elections 2025', 'AMS Candidate Profile 2025'.</li>
                            <li>4. Decide on a full name for ongoing stories such as lawsuits.</li>
                        </ol>

                    '''
                ),
                TagsFieldPanel("topics"),
                FieldPanel(
                    "primary_tag_slug",
                    widget=PrimaryTagSelect(),
                ),

                SuggestedBarFieldPanel(
                    "filter_by_tags",
                    widget=Select(choices=[
                        (False, "Section"),
                        (True, "Primary topic")
                    ])
                ),
                MultiFieldPanel(
                    [
                        HelpPanel(content="<p>THIS OVERWRITES SUGGESTED BAR. Usually creating a topic or category is better because there will be a page dedicated to that topic or category and this article's suggested bar will update when new articles in that topic or category are published. But if you have specific related articles you want to recommend rather than a topic or subsection or column, then use this.</p>"),
                        InlinePanel("connected_articles"),
                    ],
                    heading="Connected or Related Articles (Non-Series)",
                    classname="collapsible collapsed",
                ),
            ],
            heading="Categories, Topics, Suggested bar",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                FieldPanel("lede"),
                HelpPanel(content='''
                    <h1>About storystream views</h1>
                    <p>Storystream views are used to control the presentation of articles in the homepage storystream and in topic pages.</p>
                    <p>Storystream views allow us to signal effort and differentiate our articles. They also allow us to move more of the value (journalism) from articles into the homepage - making the homepage valueable in and of itself (not just a set of links to click).</p>
                    <p>Storystream views are used on the homepage and on topic pages. They display differently between these pages. Storystream views are titled according to how they are displayed in the topic pages and mobile because there is more variation between storystream views when presented on the topic pages than on the homepage.</p>
                    <h2>Guidelines for choosing storystream</h2>
                    <ol>
                        <li>1. <b>For profiles:</b> select 'Image' and the 'Profile' template. Use a cutout image of the individual. Make sure empty space is cropped out. If you don't know how to cutout an image you can ask the photo editor or web developers!</li>  
                        <li>2. <b>Quotes</b> Can be used for opinions, personal essays, interviews</li> 
                        <li>3. <b>Featured (attachment above):</b> Use when the attachment (usually the featured media image) was created by us specifically for this article</li>
                        <li>4. <b>Indent (lede + attachment below):</b> Use when there is an attachment in the article that is used as supporting information (a data visualization, a screenshot, an unedited video, a pdf, microblog post)</li>
                        <li>5. <b>Standard (Desktop homepage: Small headline + lede left, image right) (Mobile homepage, topic page: Large headline left, small featured media right):</b> Use when the article can mostly be reduced to the headline, there are no relevant attachments and the featured media image is not extremely related to the article (courtesy photo, file photo).</li>
                        <li>6. <b>Indent (lede + richtext):</b> Use for meeting recaps (AMS, Senate, BoG) or other times when there is no relevant attachment and the headline cannot be sufficiently descriptive. You can use bullet points to outline what was discussed in the meeting.</li>
                    </ol>
                    '''),
                FieldPanel("storystream_view"),
            ],
            heading="Front Page Stuff",
            classname="collapsible",
        ),
    ] # content_panels

    promote_panels = Page.promote_panels + [
        FieldPanel("timeliness", help_text = "This metadata field is used for organizing articles on the homepage and determining article relevance in search"),
        MultiFieldPanel(
            [
                FieldPanel("seo_keyword", help_text = "Seperate words with commas"),
            ],
            heading="Keywords for Search Engines",
        ),

        #  To do: Decide what to do with breaking. We would usually just put such an article
        #  as the coverstory. Is there any case where marking an article as breaking and/or 
        #  putting above the homepage header would be better than using the cover story? - Sam Low 22/05/2025
        # 
        # MultiFieldPanel(
        #    [
        #        HelpPanel(content="\"Breaking Timeout\" is irrelevant if news is not breaking news."),
        #        FieldPanel("is_breaking"),
        #        FieldPanel("breaking_timeout"),
        #    ],
        #    heading="Breaking",
        #),

        MultiFieldPanel(
            [
                FieldPanel("noindex"),
            ],
            heading="Special search engine-related meta tagging",
        ),
        
    ] # promote_panels
    settings_panels = SectionablePage.settings_panels + [
        MultiFieldPanel(
            [
                FieldPanel(
                    'is_explicit',
                    help_text = "Check if this article contains advertiser-unfriendly content. Disables ads for this specific article.",
                ),
            ],
            heading="Advertising-Releated",
        ),

    ] # settings_panels  

    customization_panels = UbysseyMenuMixin.menu_content_panels

    # This overrides the default Wagtail edit handler, in order to add custom tabs to the article editting interface
    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading='Content'),
            ObjectList(promote_panels, heading='Promote'),
            ObjectList(settings_panels, heading='Settings'),
            ObjectList(customization_panels, heading='Special article stuff'),
        ],
    ) # edit_handler

    #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = Page.search_fields + [
        index.SearchField('lede'),
        index.SearchField('seo_keyword', boost=1.5),
        index.AutocompleteField('seo_keyword'),
        index.RelatedFields(
            "topics",
            [
                index.SearchField("name", boost=10),
                index.AutocompleteField("name"),
            ],
        ),        
        index.FilterField('current_section'),
        index.FilterField('slug'),
        index.FilterField('explicit_published_at'),

        index.RelatedFields('category_page', [
            index.FilterField('slug'),
            index.SearchField('title'),
            index.AutocompleteField('title'),
        ]),
        index.RelatedFields('article_authors', [
            index.SearchField('full_name'),
            index.AutocompleteField('full_name'),
        ]),
    ]

    #-----Properties, getters, setters, etc.-----
    
    def get_featured_media_image_url(self):
        if self.featured_media.exists():
            if self.featured_media.first().image:
                return self.featured_media.first().image.file.url
        return None

    # TIMELINESS
    def get_relevance_score(self):
        relevance_delta = {
            self.TimelinessChoices.A_DAY: 1,
            self.TimelinessChoices.A_FEW_DAYS: 3,
            self.TimelinessChoices.A_WEEK: 7,
            self.TimelinessChoices.EVERGREEN: 1000
        }

        if self.published_at == None:
            return 0
        
        relevance_cutoff = timezone.now() - timezone.timedelta(days=relevance_delta[self.timeliness])

        if self.published_at > relevance_cutoff:
            return 1
        else:
            return 0

    # AUTHORS STRINGS
    def get_authors_string(self, links=False, authors_list=[]) -> str:
        """
        Returns html-friendly list of the ArticlePage's authors as a comma-separated string (with 'and' before last author).
        Keeps large amounts of logic out of templates.

          links: Whether the author names link to their respective pages.
        """
        def format_author(article_author):
            if links and article_author.author.live:
                return '<a href="%s">%s</a>' % (article_author.author.full_url, article_author.author.full_name)
            return article_author.author.full_name

        if not authors_list:
            authors_list = self.article_authors.all()

        # Create a set to track unique author names and filter duplicates
        seen_authors = set()
        unique_authors = []
        
        # Ensuring duplicate authors are not added to the author list
        for article_author in authors_list:
            author_name = article_author.author.id
            if author_name not in seen_authors:
                seen_authors.add(author_name)
                unique_authors.append(article_author)

        authors = list(map(format_author, unique_authors))
           
        if not authors:
            return ""
        elif len(authors) == 1:
            # If this is the only author, just return author name
            return authors[0]

        return ", ".join(authors[0:-1]) + " and " + authors[-1]        
    authors_string = property(fget=get_authors_string)

    def get_authors_with_urls(self) -> str:
        """
        Wrapper for get_authors_string for easy use in templates.
        """
        return self.get_authors_string(links=True)
    authors_with_urls = property(fget=get_authors_with_urls)

    def get_authors_in_order(self):
        AUTHOR_TYPES = ["org_role", "author", "photographer", "illustrator", "videographer"]
        authors = self.article_authors.all()

        authors_list = []

        for author_type in AUTHOR_TYPES:
            for author in authors:
                if author.author_role == author_type:
                    authors_list.append(author)


        return authors_list
    authors_in_order = property(fget=get_authors_in_order)

    def get_authors_in_order_for_author_cards(self):
        AUTHOR_TYPES = ["org_role", "author", "photographer", "illustrator", "videographer"]
        authors = self.article_authors.all()

        authors_dict = {}

        for author_type in AUTHOR_TYPES:
            for author in authors:
                author_id = author.author.id
                author_role = author.author_role

                if author_role == author_type:
                    if author_id not in authors_dict:
                        # Create the author dictionary containing author object and authors multiple roles
                        authors_dict[author_id] = {
                            'author': author,
                            'roles': [author_role]
                        }
                    else:
                        # If the author is already in the dict, just append the role
                        if author_role not in authors_dict[author_id]['roles']:
                            authors_dict[author_id]['roles'].append(author_role)

        return authors_dict

    authors_in_order_for_cards = property(fget=get_authors_in_order_for_author_cards)

    def get_authors_with_roles(self) -> str:
        """Returns list of authors as a comma-separated string
        sorted by author type (with 'and' before last author)."""

        role_types_words = {
            'author': 'Words by ',
            'photographer': 'Photos by ',
            'illustrator': 'Illustrations by ',
            'videographer': 'Video by ',
            'designer': 'Design by ',
        }
        role_types = ['author', 'photographer', 'illustrator', 'videographer', 'designer', 'org_role']
        authors_with_roles = []
        for i in range(len(role_types)):
            authors_with_roles.append([])

        for author in self.article_authors.all():
            if author.author_role in role_types:
                authors_with_roles[role_types.index(author.author_role)].append(author)
            
        authors_strings = []
        for i in range(len(role_types)):
            if len(authors_with_roles[i]) > 0:
                if role_types[i] == "org_role":
                    authors_strings.append(\
                        ', '.join(map(lambda a: a.author.ubyssey_role + ": " + self.get_authors_string(links=True, authors_list=[a]), authors_with_roles[i])) \
                    )
                elif role_types[i] in role_types_words:
                    authors_strings.append(\
                        role_types_words[role_types[i]] + self.get_authors_string(links=True, authors_list=authors_with_roles[i]) \
                    )
                                    
        return ', '.join(authors_strings)
    authors_with_roles = property(fget=get_authors_with_roles)
 
    def get_authors_split_out_visual_bylines(self) -> str:
        """Returns list of authors as a comma-separated string
        sorted by author type (with 'and' before last author)."""

        role_types_words = {
            'author': 'words by ',
            'photographer': 'photos by ',
            'illustrator': 'illustrations by ',
            'videographer': 'videos by ',
            'designer': 'design by ',
            'org_role': '',
        }
        role_types = ['author', 'photographer', 'illustrator', 'videographer', 'designer', 'org_role']

        authors_by_role = {}
        for author in self.article_authors.all():
            if author.author_role in authors_by_role:
                authors_by_role[author.author_role].append(author)
            else:
                authors_by_role[author.author_role] = [author]

        word_authors = []
        words_byline = ""
        if 'author' in authors_by_role:
            word_authors = list(map(lambda author: author.author, authors_by_role['author']))
            words_byline = self.get_authors_string(links=True, authors_list=authors_by_role['author'])
    
        visuals = []
        has_multi_contribution_author = False
        for k in authors_by_role:
            v = authors_by_role[k]
            visual_authors = map(lambda author: author.author, v)
            if True in [word_author in visual_authors for word_author in word_authors]:
                has_multi_contribution_author = True
            only_visuals_authors = list(filter(lambda author: not author.author in word_authors, v))
            if len(only_visuals_authors) > 0:
                visuals.append([k, self.get_authors_string(links=True, authors_list=only_visuals_authors)])
        visuals.sort(key=lambda s: role_types.index(s[0]))
        
        visuals_byline = ''

        if len(visuals) > 0:
            visuals_byline = visuals_byline + ', '.join(map(lambda a: role_types_words[a[0]] + a[1], visuals))
            if has_multi_contribution_author:
                visuals_byline = 'with ' + visuals_byline

        byline = ""
        if words_byline != "":
            byline = words_byline + " " + visuals_byline
        elif len(visuals_byline) > 0:
            byline = visuals_byline[0].upper() + visuals_byline[1:]

        return byline
        
    authors_split_out_visual_bylines = property(fget=get_authors_split_out_visual_bylines)    

    def get_category_articles(self, order='-first_published_at', max=False) -> QuerySet:
        """
        Returns a list of articles within the Article's category
        """
        category_articles = ArticlePage.objects.live().filter(category_page=self.category_page).not_page(self).order_by(order)
        if max:
            return category_articles[:max]
        return category_articles
    
    def get_section_articles(self, order='-first_published_at', max=10) -> QuerySet:
        """
        Returns a list of articles within the Article's section
        """

        section_articles = ArticlePage.objects.live().child_of(self.get_parent()).not_page(self).order_by(order)[:max]
        
        return section_articles
    def get_articles_by_tag(self, order='-first_published_at', max=5) -> QuerySet:
        """
        Returns a list of articles with the same tags as the current article
        """
        articles_by_tag = []
        if self.primary_tag_slug:
            articles_by_tag = ArticlePage.objects.live().child_of(self.get_parent()).filter(topics__slug=self.primary_tag_slug).not_page(self).order_by(order)[:max]
            if len(articles_by_tag) == 0:
                articles_by_tag = ArticlePage.objects.live().child_of(self.get_parent()).filter(topics__name=self.primary_tag_slug).not_page(self).order_by(order)[:max]
        return articles_by_tag

    def get_primary_suggested(self, number_suggested=6):
        """
        Defines the title and articles in the suggested box
        """
        suggested = {}
        MIN_ARTICLES = 3
        if len(self.connected_articles.all()) > 0:
            suggested = {}
            suggested['title'] = "Related stories"
            suggested['articles'] = list(map(lambda article: article.connected_article, self.connected_articles.all()))      
            suggested['type'] = 'connected'
        elif self.filter_by_tags:
            articles_by_tag = self.get_articles_by_tag(max=number_suggested)
            if len(articles_by_tag) >= MIN_ARTICLES:
                if ArticleTopic.objects.filter(slug=self.primary_tag_slug).exists():
                    tag = ArticleTopic.objects.get(slug=self.primary_tag_slug)
                elif ArticleTopic.objects.filter(name=self.primary_tag_slug).exists():
                    tag = ArticleTopic.objects.get(name=self.primary_tag_slug)
                suggested = {}
                suggested['title'] = "More on <a href='/topic/" + tag.slug + "/'>" + tag.name + "</a>"
                suggested['articles'] = articles_by_tag[:number_suggested]
                suggested['type'] = 'topic'
        if not suggested:
            if self.category_page != None:
                category_articles = self.get_category_articles(max=number_suggested)
                if len(category_articles) >= MIN_ARTICLES:
                    suggested = {}
                    suggested['title'] = "More from <a href='" + self.category_page.url + "'>" + self.category_page.title + "</a>"
                    suggested['articles'] = category_articles[:number_suggested]
                    suggested['type'] = 'category'

        if not suggested:
            section_articles = self.get_section_articles(max=number_suggested)
            #if len(section_articles) >= MIN_ARTICLES:
            suggested = {}
            suggested['title'] = "More from <a href='" + self.get_parent().url + "'>" + self.get_parent().title + "</a>"
            suggested['articles'] = section_articles[:number_suggested]
            suggested['type'] = 'section'
        
        if not suggested:
            suggested = False

        return suggested

    def get_suggested(self, topic_max=4):
        '''
        Determines the articles to suggested at the bottom of the page based on listed topics, category, primary topic, section, and editor choice
        '''

        # Gathers the 2-6 large articles suggested at the bottom of the page
        primary = self.get_primary_suggested()

        # The rest is determining the "topics" to suggest on the right of those articles

        # "seen articles" are tracked to avoid suggesting duplicates or the article itself
        seen_articles = [self.id]
        if primary:
            seen_articles = seen_articles + [article.id for article in primary['articles']]

        # Holds each topic to be listed on the right of the suggested bar
        topic_articles = []

        # If the category is not used for the primary suggested, then add the category as a "topic"
        category = self.category_page
        if category and primary['type'] != 'category':
            topic_articles.append({
                "topic": f'<a href="{category.url}">{category.title}</a>',
                "considered_articles": category.get_recent_articles(max_items=5),
                "type": "category",
            })
        
        time_cutoff = timezone.now() - timezone.timedelta(weeks=150)

        if self.current_section in ['opinion', 'humour', 'features'] and self.primary_tag_slug:
            primary_topic = self.get_primary_topic()
            if primary_topic != None:
                topic_articles.append({
                    "topic": f'News: <a href="/topic/{primary_topic.slug}/">{primary_topic.name}</a>',
                    "considered_articles": ArticlePage.objects.filter(topics=primary_topic, current_section="news", explicit_published_at__gte=time_cutoff).order_by("-first_published_at")[:5],
                    "type": "other section",
                })

        if primary:
            if primary['type'] != 'topic' and self.primary_tag_slug:
                primary_topic = self.get_primary_topic()
                if primary_topic:
                    topic_articles.append(
                        {
                            "topic": f'<a href="/topic/{primary_topic.slug}/">{primary_topic.name}</a>',
                            "considered_articles": ArticlePage.objects.filter(topics=primary_topic, current_section=self.current_section, explicit_published_at__gte=time_cutoff).order_by("-first_published_at")[:5],
                            "type": "topic",
                        }
                )

        # Get the article's topics marked as listed
        listed_topics = self.topics.filter(listed=True) \
            .exclude(slug=self.primary_tag_slug) \
            .order_by("last_used_at")

        # Add each listed topic, order by article publish date 
        topic_articles = topic_articles + list(sorted([
            {
                "topic": f'<a href="/topic/{topic.slug}/">{topic.name}</a>',
                "considered_articles": ArticlePage.objects.filter(topics=topic, current_section=self.current_section, explicit_published_at__gte=time_cutoff).order_by("-first_published_at")[:5],
                "type": "topic",
            } for topic in listed_topics
        ], key= lambda topic: topic["considered_articles"][0].first_published_at.timestamp() if len(topic["considered_articles"]) > 0 else 0, reverse=True))

        # Choose articles from each of the topic and combine topics with shared articles
        article_count = 0
        new_added = True
        combined_topics = []

        while article_count < topic_max and new_added:
            new_added = False
            for topic in topic_articles:
                for article in topic["considered_articles"]:
                    if not article.id in seen_articles:
                        combined = False
                        for combined_topic in combined_topics:
                            if article in combined_topic["possible_articles"] and not False in [combined_topic_article in topic["considered_articles"] for combined_topic_article in combined_topic["articles"]]:
                                combined_topic["articles"].append(article)
                                combined_topic["possible_articles"] = list(filter(lambda article: article in topic["considered_articles"], combined_topic["possible_articles"]))
                                if not topic["topic"] in combined_topic["topic"]:
                                    combined_topic["topic"] = combined_topic["topic"] + ", " + topic["topic"]
                                combined = True
                                break
                        if not combined:
                            combined_topics.append({
                                "topic": topic["topic"],
                                "articles": [article],
                                "possible_articles": topic["considered_articles"],
                                "type": topic["type"]
                            })

                        seen_articles.append(article.id)
                        article_count = article_count + 1
                        new_added = True
                        break
                if article_count >= topic_max:
                    break

        orderd_topics = list(filter(lambda topic: topic["type"]=="category", combined_topics)) + \
            list(sorted(filter(lambda topic: topic["type"]=="topic", combined_topics), key= lambda topic: topic["articles"][0].first_published_at, reverse=True)) + \
            list(filter(lambda topic: not topic["type"] in ["category", "topic"], combined_topics))

        # Ensure the number of topics is at or below the maximum
        orderd_topics = orderd_topics[:topic_max]

        return {"primary": primary, "topics": orderd_topics}


    def get_title_tag(self) -> str:
        if self.title_tag:
            return self.title_tag
        elif self.category_page:
            return self.category_page.title
        else:
            False
    title_tag_str = property(fget=get_title_tag)

    def get_primary_topic(self) -> str:
        return ArticleTopic.objects.filter(slug=self.primary_tag_slug).first()

    def get_primary_tag_link(self) -> str:
        tag = ArticleTopic.objects.filter(slug=self.primary_tag_slug).first()
        if tag != None:
            return "<a href='/topic/" + tag.slug + "/'>" + tag.name + "</a>"
        return ""
    primary_tag_link = property(fget=get_primary_tag_link)

    @property
    def published_at(self):
        if self.explicit_published_at:
            return self.explicit_published_at
        return self.first_published_at

    def first_online_at(self):
        # Some articles seem to have correct explicit published but not first published (due to migration). 
        # Others have correct explicit but not correct first published (due to editors not understanding the explicit field).
        if self.explicit_published_at and self.first_published_at:
            if self.explicit_published_at - self.first_published_at < timezone.timedelta(days=5):
                return self.first_published_at
        return self.explicit_published_at
    
    def is_live(self):
        # maybe this is a stupid way to check, but I wanted to leave the possibility of multiple liveblog page types in the future - Sam Low 2026-01-14
        if "live" in str(self.specific_class):
            return self.specific.is_live()
        return False

    class Meta:
        # TODO Should probably index on:
        # Author then article
        verbose_name = "Article"
        verbose_name_plural = "Articles"
        indexes = [
            models.Index(fields=['current_section','last_modified_at']),
            models.Index(fields=['last_modified_at']),
            models.Index(fields=['category_page',]),
        ]

class StandardArticlePage(ArticlePage):
    #-----Django/Wagtail settings etc-----
    objects = ArticlePageManager()

    parent_page_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'section.SectionPage',
        'wagtailcore.Page',
    ]

    subpage_types = [] #Prevents article pages from having child pages

    show_in_menus_default = True
    show_in_menus = True

    #-----Field attributes-----

    header = StreamField(
        [
            ('standard_header', blocks_inner_article.StandardHeader()),
            ('standard_header_with_youtube_video', blocks_inner_article.StandardHeaderWithYoutTubeVideo()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
        default = [
            {"type": "standard_header",
             "value": {"title": "", "layout": "bottom-image", "subtitle": "", "above_cut_lede": ""}}
        ]
    )

    content = StreamField(
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
            ('extra_article_info', blocks_inner_article.ExtraArticleInfoBlock()),
            ('dropcap', blocks.TextBlock(
                label = "Dropcap Block",
                template = 'article/stream_blocks/dropcap.html',
                help_text = "Create a block where special dropcap styling with be applied to the first letter and the first letter only.\n\nThe contents of this block will be enclosed in a <p class=\"drop-cap\">...</p> element, allowing its targetting for styling.\n\nNo RichText allowed."
            )),
            ('video', video_blocks.OneOffVideoBlock(
                label = "Credited/Captioned One-Off Video",
                help_text = "Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block."
            )),
            ('audio', blocks_inner_article.AudioBlock()),
            ('image', image_blocks.ImageBlock()),
            ('gallery_block', blocks_inner_article.GalleryBlock(
                label="Image carousel",
            )),
            ('image_grid', blocks_inner_article.ImageGrid()),
            ('image_wall', blocks_inner_article.ImageWall()),
            ('attachment_overlay', blocks_inner_article.AttachmentOverlay(
                help_text = "The first attachment is the base. When this block is in view, the subsequent attachments fade in."
            )),
            ('image_header', blocks_inner_article.IntraArticleImageBanner()),
            ('pdf', blocks_inner_article.PdfBlock()),
            ('raw_html', blocks.RawHTMLBlock(
                label = "Raw HTML Block",
                help_text = "WARNING: DO NOT use this unless you really know what you're doing!"
            )),
            ('quote', blocks_inner_article.PositionedPullQuote()),
            ('header_link', blocks_inner_article.HeaderLinkBlock()),
            ('header_menu', blocks_inner_article.HeaderMenuBlock()),
            ('visual_essay', blocks_inner_article.VisualEssayBlock()),
            ('personality_quiz', blocks_inner_article.PersonalityQuizBlock()),
            ('plaintext', blocks.TextBlock(
                label="Plain Text Block",
                help_text = "Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text."
            )),
            ('gallery', SnippetChooserBlock(
                target_model = GallerySnippet,
                template = 'article/stream_blocks/gallery.html',
            )),
            ('cards', blocks_inner_article.CardContainer()),
            ('article_promo', blocks_inner_article.ArticlePromoBlock()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )
    
    disclaimer = RichTextField(
        null=False,
        blank=True,
        default='',
        help_text = "Used for Opinion articles or when corrections are made"
    )

    # template #TODO

    #-----Hidden stuff: editors don't get to modify these, but they may be programatically changed-----

    legacy_template = models.CharField(
        null=False,
        blank=True,
        default='',
        max_length=3000,
    )
    legacy_template_data = models.TextField(
        null=False,
        blank=True,
        default='',
    )
    legacy_revision_number = models.IntegerField(
        default=0
    )

    # "Layouts (stores data that once was Template data)"
    layout = models.CharField(
        null=False,
        blank=False,
        default='default',
        verbose_name='Article Layout',
        help_text="These correspond to very frequently used templates. More \"bespoke\", one-off templates should be added to the library of DB Templates",
        max_length=100,
    )

    fw_alternate_title = models.CharField(
        null=False,
        blank=True,
        default='',
        verbose_name='Alternate Title (Optional)',
        help_text="When there is a \"special feature\" or full-width style article, sometimes we would like to override the title as it render in the template",
        max_length=255,
    )

    subtitle = models.CharField(
        null=False,
        blank=True,
        default='',
        verbose_name='Subtitle (Optional)',
        help_text="Displayed below the title",
        max_length=255,
    )
    
    # Corresponds to the pseudo-field called "snippet" in some templates
    above_cut_lede = models.TextField(
        null=False,
        blank=True,
        default='',
        verbose_name='Above Cut Lede (Optional)',
        help_text="Articles that use a special header/banner often contain a second lede/abstract summary ",
    )

    # Featured image stuff used for template customization
    header_layout = models.CharField(
        null=False,
        blank=False,
        default='right-image',
        max_length=50,
        help_text="Based on from Dispatch's obselete \"Templates\" feature",
    )

    #-----Advanted, custom layout etc-----
    use_default_template = models.BooleanField(default=True)

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

        if self.layout == 'empty':
            return "article/article_page_empty.html"
        elif self.layout == 'timeless-meta-page':
            return "article/article_page_timeless_meta_page.html"
        elif self.layout == 'visual-essay':
            return "article/article_page_visual_essay.html"
        elif self.layout == 'guide-2020':
            return "article/article_page_guide_2020.html"
        elif self.layout == 'guide-2022':
            return "article/article_page_guide_2022.html"
        elif self.layout == 'magazine-2023':
            return "article/article_page_magazine_2023.html"
        elif self.layout == 'guide-2023':
            return "article/article_page_guide_2023.html"
        elif self.layout == 'magazine-2024':
            return "article/article_page_magazine_2024.html"
        elif self.layout == 'spoof-2024':
            return "article/article_page_spoof_2024.html"
        elif self.layout == 'guide-2024':
            return "article/article_page_guide_2024.html"
        elif self.layout == 'science-2024':
            return "article/article_page_supplement_2024_science.html"
        elif self.layout == 'femme-2024':
            return "article/supplements/article_page_supplement_2024_femme.html"
        elif self.layout == 'nocturne-2024':
            return "article/supplements/article_page_supplement_2024_nocturne.html"
        elif self.layout == 'passing-2025':
            return "article/supplements/article_page_supplement_2025_passing.html"
        elif self.layout == 'right-column':
            return "article/article_like_special_page.html"

        return "article/article_page.html"

    #-----For Wagtail's user interface-----
    content_panels = Page.content_panels + [
        FieldRowPanel(
            [
                FieldPanel("explicit_published_at"),
                FieldPanel("show_last_modified"),
            ],
            heading="Publication Date",
        ),
        MultiFieldPanel(
            [ 
                FieldPanel('title_tag'),
                InlinePanel("featured_media", label="Featured Image or Video"),
                FieldPanel("header"),
            ],
            heading = "Header/Banner Fields",
            classname="collapsible",
        ), # Optional Header/Banner Fields
        MultiFieldPanel(
            [
                HelpPanel(
                    content='<h1>Help: Writing Articles</h1><p>The main contents of the article are organized into \"blocks\". Click the + to add a block. Most article text should be written in Rich Text Blocks, but many other features are available!</p><p>Blocks simply represent units of the article you may wish to re-arrange. You do not have to put every individual paragraph in its own block (doing so is probably time consuming!). Many articles that have been imported into our database DO divide every paragraph into its own block, but this is for computer convenience during the import.</p>'
                ),
                FieldPanel("content"),
                FieldPanel("disclaimer")
            ],
            heading="Article Content",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                HelpPanel(content="Authors may be created by creating an \"Author Page\", then selected here."),
                InlinePanel("article_authors", min_num=1, max_num=20, label="Author"),
            ],
            heading="Author(s)",
            classname="collapsible",
        ), # Author(s)
        MultiFieldPanel(
            [
                FieldPanel("category_page"),
                HelpPanel(
                    content='''
                        <h1>About Topics</h1>
                        <p>Topics entered here will be listed in the topic page with the format <a href='https://ubyssey.ca/topic/top-stories/' target='_blank'>https://ubyssey.ca/topic/top-stories/</a>.</p>
                        <p>Do NOT think of this like tagging an instagram post. It is NOT useless metadata or for SEO. <b><u>We tag articles so that ongoing subjects and stories are easy for readers to find and follow within our website</u></b>. These readers include everyone from students studying at UBC right now, to future Ubyssey editors, and journalists covering UBC at larger publications like the CBC and the Globe and Mail. <i>(More needs to be done to make use of topics and link to topic pages on the website. I'm working on it! - Sam Low)</i></p>
                        <p>Make articles from our archive easier to find and they will be read more often. Tagging newspapers has a long history. The New York Times became known as the 'Paper of Record' because of its <a href='https://en.wikipedia.org/wiki/New_York_Times_Index' target='_blank'>New York Times Index</a> which rigoursly tagged every article of every paper by topic. This act unlocked the value of their archive and secured New York Times reporting center stage in the canon of history.</p>
                        <h2>Tips for topics</h2>
                        <ol>
                            <li>1. Consistency is very important. Use the full name with correct capitalization every time.</li>
                            <li>2. Tag the full name of every subject of the article. Subjects can include individuals, organizations, buildings, exhibits, concepts, etc.</li>
                            <li>3. Add tags at all levels of specificity. For example 'AMS', 'AMS Candidate Profile'  'AMS elections', 'AMS elections 2025', 'AMS Candidate Profile 2025'.</li>
                            <li>4. Decide on a full name for ongoing stories such as lawsuits.</li>
                        </ol>

                    '''
                ),
                TagsFieldPanel("topics"),
                FieldPanel(
                    "primary_tag_slug",
                    widget=PrimaryTagSelect(),
                ),

                SuggestedBarFieldPanel(
                    "filter_by_tags",
                    widget=Select(choices=[
                        (False, "Section"),
                        (True, "Primary topic")
                    ])
                ),
                MultiFieldPanel(
                    [
                        HelpPanel(content="<p>THIS OVERWRITES SUGGESTED BAR. Usually creating a topic or category is better because there will be a page dedicated to that topic or category and this article's suggested bar will update when new articles in that topic or category are published. But if you have specific related articles you want to recommend rather than a topic or subsection or column, then use this.</p>"),
                        InlinePanel("connected_articles"),
                    ],
                    heading="Connected or Related Articles (Non-Series)",
                    classname="collapsible collapsed",
                ),
            ],
            heading="Categories, Topics, Suggested bar",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                FieldPanel("lede"),
                HelpPanel(content='''
                    <h1>About storystream views</h1>
                    <p>Storystream views are used to control the presentation of articles in the homepage storystream and in topic pages.</p>
                    <p>Storystream views allow us to signal effort and differentiate our articles. They also allow us to move more of the value (journalism) from articles into the homepage - making the homepage valueable in and of itself (not just a set of links to click).</p>
                    <p>Storystream views are used on the homepage and on topic pages. They display differently between these pages. Storystream views are titled according to how they are displayed in the topic pages and mobile because there is more variation between storystream views when presented on the topic pages than on the homepage.</p>
                    <h2>Guidelines for choosing storystream</h2>
                    <ol>
                        <li>1. <b>For profiles:</b> select 'Image' and the 'Profile' template. Use a cutout image of the individual. Make sure empty space is cropped out. If you don't know how to cutout an image you can ask the photo editor or web developers!</li>  
                        <li>2. <b>Quotes</b> Can be used for opinions, personal essays, interviews</li> 
                        <li>3. <b>Featured (attachment above):</b> Use when the attachment (usually the featured media image) was created by us specifically for this article</li>
                        <li>4. <b>Indent (lede + attachment below):</b> Use when there is an attachment in the article that is used as supporting information (a data visualization, a screenshot, an unedited video, a pdf, microblog post)</li>
                        <li>5. <b>Large headline</b> Use when the article can mostly be reduced to the headline, there are no relevant attachments and the featured media image is not extremely related to the article (courtesy photo, file photo).</li>
                        <li>6. <b>Indent (lede + richtext):</b> Use for meeting recaps (AMS, Senate, BoG) or other times when there is no relevant attachment and the headline cannot be sufficiently descriptive. You can use bullet points to outline what was discussed in the meeting.</li>
                    </ol>
                    '''),
                FieldPanel("storystream_view"),
            ],
            heading="Front Page Stuff",
            classname="collapsible",
        ),
    ] # content_panels

    promote_panels = ArticlePage.promote_panels

    settings_panels = SectionablePage.settings_panels + ArticlePage.settings_panels

    customization_panels = [
        HelpPanel(
            content = "<h1>Help</h1><p>IF you need an alternate layout for your article, but still a frequently-used layout (such as including a full-width banner), THEN, rather making than a highly customized frontend (as you can do in the next tab over), select the options you require here.</p> <p>The majority of articles will just use the default layout. Thus, <u>for the majority of articles, nothing on this tab should be touched</u>; the majority of these fields are not even used in most layouts. They primarily exist to keep our data organized.</p>"
        ),
        MultiFieldPanel(
            [
                FieldPanel(
                    "layout",
                    widget=Select(
                        choices=[
                            ('default', 'Default'),                             
                            ('timeless-meta-page', 'Timeless meta page'),
                            ('empty', 'Empty template'),
                            ('right-column', "Right Column"),
                            ('visual-essay', 'Visual Essay'),
                            ('guide-2020', 'Guide (2020 style - currently broken, last checked 2022/09)'),
                            ('guide-2022', 'Guide (2022 style)'),
                            ('magazine-2023', 'Magazine (2023 style)'),
                            ('guide-2023', 'Guide (2023 style)'),
                            ('magazine-2024', 'Magazine (2024 style)'),
                            ('spoof-2024', 'Spoof (2024 style)'),
                            ('guide-2024', 'Guide (2024 style)'),
                            ('science-2024', 'Science Supplement (2024)'),
                            ('femme-2024', 'Femme Culture Special Issue (2024)'),
                            ('nocturne-2024', 'Nocturne Features Supplement (2024)'),
                            ('passing-2025', 'Passing Special Article (2025)')
                        ],
                    ),
                ),
            ],
            heading = "Select Stock Layout",
            classname="collapsible",
        ), # Select Stock Layout
        ] + UbysseyMenuMixin.menu_content_panels + [
           
        #   To Do: This is not used anywhere. Figure out what exactly timeline was for. If it was
        #   a good idea then we can pick it up. I'm pretty sure even it was a good idea it was a
        #   bad implementation though. So deal with articles that used it (if any) and then remove 
        #   the fields - Sam Low (22/05/2025)
        #
        # MultiFieldPanel(
        #    [
        #        HelpPanel(content='<h1>Warning</h1><p>If a timeline is included in your article, <u>additional processing will be required when the article is saved</u>.</p><p>It is recommended you add a Timeline snippet LAST, <i>after</i> your article is otherwise written.</p><p><u>Developers</u> should note: the Timeline/Article sync is accomplished with Django signals, to prevent tight coupling of the two classes. Do not allow use of signals to turn into noodle logic.</p>'),
        #        FieldPanel('show_timeline'),
        #        FieldPanel('timeline_date'),
        #        FieldPanel('timeline'),
        #    ],
        #    heading = "Timeline",
        #    classname="collapsible collapsed",
        #), # Timeline
        
        #   To Do: Individually deal with any article using it and remove the fw_about_this_article
        #   field. Something like this can be handled within the content streamfield such as with
        #   an extra article info editors note. 
        # MultiFieldPanel(
        #    [
        #        HelpPanel(content="<p>This information is generally used in a special article that has additional credits beyond the normal byline.</p>"),
        #        FieldPanel('fw_about_this_article'),
        #    ],
        #    heading = "Additional Credits",
        #    classname="collapsible collapsed",
        #), # Additional Credits
        HelpPanel(
            content="<h1>Help</h1><p>This tab exists so that every aspect of the frontend for an individual article may be customized, down to the finest detail. There are three fundamental tools of frontend web programming - HTML, CSS and JavaScript, and here you may utilize all three.</p><p>Custom HTML templates, which use the Django templating language, should be uploaded not as files/documents but as \"Custom HTML\" in the site admin.\n\n Custom CSS or JavaScript should be uploaded to \"Documents\"</p>"
        ),
        MultiFieldPanel(
            [
                HelpPanel(
                    content="<p>Making a template requires some understanding of how the Django backend works, so that you might know variable names etc. for the data that the template is supposed to render.</p> <p>Because of the potential complexity of a template, it is desirable to be able to quickly switch the article back to a default template. Turn on \"Use default template\" to use the stock template and turn it off to be able to override the default with a custom template. Defaults to \"on\".</p>",
                ),
                FieldPanel("use_default_template"),
                FieldPanel("db_template"),
            ],
            heading="Custom HTML",
            classname="collapsible collapsed",
        ), # Custom HTML
        MultiFieldPanel(
            [
                InlinePanel("styles"),
            ],
            heading="Custom CSS",
            help_text="Please upload any custom CSS to \"Documents\", then select the appropriate document here.\n\nSelecting a non-CSS Document will cause errors.",
            classname="collapsible collapsed",
        ), # Custom CSS
        MultiFieldPanel(
            [
                InlinePanel("scripts"),
            ],
            heading="Custom JavaScript",
            help_text="Please upload any custom JavaScript to \"Documents\", then select the appropriate document here.\n\nSelecting a non-JavaScript Document will cause errors.",
            classname="collapsible collapsed",
        ), # Custom JavaScript
    ] # customization_panels

    # This overrides the default Wagtail edit handler, in order to add custom tabs to the article editting interface
    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading='Content'),
            ObjectList(promote_panels, heading='Promote'),
            ObjectList(settings_panels, heading='Settings'),
            ObjectList(customization_panels, heading='Special article stuff'),
        ],
    ) # edit_handler

    #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = Page.search_fields + [
        index.SearchField('lede'),
        index.SearchField('seo_keyword', boost=1.5),
        index.AutocompleteField('seo_keyword'),
        index.RelatedFields(
            "topics",
            [
                index.SearchField("name", boost=10),
                index.AutocompleteField("name"),
            ],
        ),        
        index.FilterField('current_section'),
        index.FilterField('slug'),
        index.FilterField('explicit_published_at'),

        index.RelatedFields('category_page', [
            index.FilterField('slug'),
            index.SearchField('title'),
            index.AutocompleteField('title'),
        ]),
        index.RelatedFields('article_authors', [
            index.SearchField('full_name'),
            index.AutocompleteField('full_name'),
        ]),
    ]

    #-----Properties, getters, setters, etc.-----

    def get_context(self, request, *args, **kwargs):
        """
        Wagtail uses this method to add context variables following a request at a URL.
        All the below code occurs after the user submits a request and before they receive it.
        Therefore, keep the length of this method to a minimum; otherwise users will be kept waiting
        """

        context = super().get_context(request, *args, **kwargs)

        user_agent = get_user_agent(request)
        context['is_mobile'] = user_agent.is_mobile
        if self.current_section == "guide":
            context['prev'] = self.get_prev_sibling()
            context['next'] = self.get_next_sibling()
            
            if self.current_section == 'guide':
                # Desired behaviour for guide articles is to always have two adjacent articles. Therefore we create an "infinite loop"
                if not context['prev']:
                    context['prev'] = self.get_last_sibling()
                if not context['next']:
                    context['next'] = self.get_first_sibling()

            if context['prev']:
                context['prev'] = context['prev'].specific
            if context['next']:
                context['next'] = context['next'].specific

        return context

    @property
    def word_count(self) -> int:
        # gotten from https://stackoverflow.com/questions/42585858/display-word-count-in-blog-post-with-wagtail
        count = 0
        for block in self.content:
            if block.block_type == 'richtext' or block.block_type == 'plaintext':
                count += len(str(block.value).split())
        return count

    @property
    def minutes_to_read(self) -> int:
        """
        Assumes readers read 150 wpm on average. Returns self.world_count // 150
        """
        return self.word_count // 150

    class Meta:
        # TODO Should probably index on:
        # Author then article
        verbose_name = "Standard Article"
        verbose_name_plural = "Standard Articles"


class SpecialArticleLikePage(ArticlePage):

    show_in_menus_default = True

    parent_page_types = []

    subpage_types = [] #Prevents article pages from having child pages

    right_column_content = StreamField(
        # intended for use only for the About/Contant Us page as of Jun 9, 2022
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
            ('plaintext',blocks.TextBlock(
                label="Plain Text Block",
                help_text = "Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text."
            )),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    content_panels = ArticlePage.content_panels + [
        MultiFieldPanel(
            [
                HelpPanel(
                    content=''
                ),
                FieldPanel("right_column_content")
            ],
            heading="Article Right Column Content",
            classname="collapsible",
        ),
    ]

    class Meta:
        verbose_name = "Special Article-Like Page (for About Page, Contact, etc.)"
        verbose_name_plural = "Articles"

class StandardArticlePageWithRightColumn(StandardArticlePage):

    right_column_content = StreamField(
        # intended for use only for the About/Contant Us page as of Jun 9, 2022
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
            ('plaintext',blocks.TextBlock(
                label="Plain Text Block",
                help_text = "Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text."
            )),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    content_panels = StandardArticlePage.content_panels + [
        MultiFieldPanel(
            [
                HelpPanel(
                    content=''
                ),
                FieldPanel("right_column_content")
            ],
            heading="Article Right Column Content",
            classname="collapsible",
        ),
    ]

    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading='Content'),
            ObjectList(StandardArticlePage.promote_panels, heading='Promote'),
            ObjectList(StandardArticlePage.settings_panels, heading='Settings'),
            ObjectList(StandardArticlePage.customization_panels, heading='Special article stuff'),
        ],
    )

    class Meta:
        verbose_name = "Standard Article Page with Right Column (for About Page, Contact, etc.)"
        verbose_name_plural = "Articles"