import datetime
import json
from tabnanny import verbose

from wagtail.admin import edit_handlers
from images.models import GallerySnippet

from dbtemplates.models import Template as DBTemplate

from django.db import models
from django.db.models import fields
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

from taggit.models import TaggedItemBase

from videos import blocks as video_blocks
from wagtail.contrib.routable_page.models import RoutablePageMixin, route
from article import blocks as article_blocks

from wagtail.admin.edit_handlers import (
    # Panels
    FieldPanel,
    FieldRowPanel,
    HelpPanel,
    InlinePanel,
    MultiFieldPanel,
    PageChooserPanel, 
    StreamFieldPanel,
    # Custom admin tabs
    ObjectList,
    TabbedInterface,
)

from wagtail.core import blocks
from wagtail.core.fields import StreamField
from wagtail.core.models import Page, PageManager, Orderable
from wagtail.documents.models import Document
from wagtail.documents.blocks import DocumentChooserBlock
from wagtail.documents.edit_handlers import DocumentChooserPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.search import index
from wagtail.snippets.blocks import SnippetChooserBlock
from wagtail.snippets.edit_handlers import SnippetChooserPanel
from wagtail.snippets.models import register_snippet


from wagtailmenus.models import FlatMenu

from wagtailmodelchooser.edit_handlers import ModelChooserPanel

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
                ModelChooserPanel('menu'),
                FieldPanel('create_menu_from_parent'),
                PageChooserPanel('parent_page_for_menu_generation'),
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
                PageChooserPanel("author"),
                FieldPanel(
                    "author_role",
                    widget=Select(
                        choices=[
                            ('author', 'Author'), 
                            ('illustrator','Illustrator'),
                            ('photographer','Photographer'),
                            ('videographer','Videographer'),
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
    article_description = models.TextField(
        null=False,
        blank=True,
        default='',
    )
    parent_article = ParentalKey(
        "article.ArticlePage",
        default='',
        related_name="connected_articles",
    )

    panels = [
        MultiFieldPanel(
            [
                PageChooserPanel('connected_article'),
            ],
            heading="Article"
        ),
        FieldPanel('article_description')
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
                PageChooserPanel('article'),
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
    # style = models.CharField(max_length=255, blank=True, null=False, default='')
    # width = models.CharField(max_length=255, blank=True, null=False, default='')
    image = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    video = models.ForeignKey(
        "videos.VideoSnippet",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    panels = [
        MultiFieldPanel(
            [
                ImageChooserPanel("image"),
                SnippetChooserPanel("video"),
            ],
            heading="Media Choosers",
        ),
        MultiFieldPanel(
            [
                FieldPanel("caption"),
                FieldPanel("credit"),
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
                DocumentChooserPanel('css'),
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
                DocumentChooserPanel('script'),
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
class ArticlePageTag(TaggedItemBase):
    """
    Reference: 
    https://docs.wagtail.io/en/stable/reference/pages/model_recipes.html
    """
    content_object = ParentalKey('article.ArticlePage', on_delete=models.CASCADE, related_name='tagged_items')
    class Meta:
        verbose_name = "article tag"
        verbose_name_plural = "article tags"

#-----Manager models-----
class ArticlePageManager(PageManager):
    
    def from_section(self, section_slug='', section_root=None) -> QuerySet:
        from .models import ArticlePage
        from section.models import SectionPage
        
        if section_slug:
            try:
                section_root = SectionPage.objects.get(slug=section_slug)
                articles = self.live().public().descendant_of(section_root).exact_type(ArticlePage)
            except SectionPage.DoesNotExist:
                articles = SectionPage.objects.none()
            
        return articles
    
    def from_magazine_special_section(self, section_slug='', section_root=None) -> QuerySet:
        from .models import ArticlePage
        from specialfeaturelanding.models import SpecialLandingPage
        if section_slug:
            try:
                section_root = SpecialLandingPage.objects.get(category__slug=section_slug)
                articles = self.live().public().descendant_of(section_root).exact_type(ArticlePage) 
            except SpecialLandingPage.DoesNotExist:
                articles = SpecialLandingPage.objects.none()

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

    show_in_menus_default = False

    #-----Field attributes-----
    content = StreamField(
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your article contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
            ('plaintext', blocks.TextBlock(
                label="Plain Text Block",
                help_text = "Warning: Rich Text Blocks preferred! Plain text primarily exists for importing old Dispatch text."
            )),
            ('dropcap', blocks.TextBlock(
                label = "Dropcap Block",
                template = 'article/stream_blocks/dropcap.html',
                help_text = "DO NOT USE - Legacy block. Create a block where special dropcap styling with be applied to the first letter and the first letter only.\n\nThe contents of this block will be enclosed in a <p class=\"drop-cap\">...</p> element, allowing its targetting for styling.\n\nNo RichText allowed."
            )),
            ('video', video_blocks.OneOffVideoBlock(
                label = "Credited/Captioned One-Off Video",
                help_text = "Use this to credit or caption videos that will only be associated with this current article, rather than entered into our video library. You can also embed videos in a Rich Text Block."
            )),
            ('image', image_blocks.ImageBlock(
            )),
            ('raw_html', blocks.RawHTMLBlock(
                label = "Raw HTML Block",
                help_text = "WARNING: DO NOT use this unless you really know what you're doing!"
            )),
            ('quote', article_blocks.PullQuoteBlock()),
            ('gallery', SnippetChooserBlock(
                target_model = GallerySnippet,
                template = 'article/stream_blocks/gallery.html',
            )),
            ('header_link', article_blocks.HeaderLinkBlock()),
            ('header_menu', article_blocks.HeaderMenuBlock()),
            ('visual_essay', article_blocks.VisualEssayBlock()),
        ],
        null=True,
        blank=True,
    )
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
    lede = models.TextField(
        # Was called "snippet" in Dispatch - do not want to reuse this work, so we call it 'lede' instead
        null=False,
        blank=True,
        default='',
    )

    #-----Category and Tag stuff-----
    category = models.ForeignKey(
        "section.CategorySnippet",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )
    tags = ClusterTaggableManager(through='article.ArticlePageTag', blank=True)

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

    fw_optional_subtitle = models.CharField(
        null=False,
        blank=True,
        default='',
        verbose_name='Subtitle (Optional)',
        help_text="When there is a \"special feature\" or full-width style article, sometime we want to add a subtitle alongside the title",
        max_length=255,
    )
    
    # Corresponds to the pseudo-field called "snippet" in some templates
    fw_above_cut_lede = models.TextField(
        null=False,
        blank=True,
        default='',
        verbose_name='Above Cut Lede (Optional)',
        help_text="Articles that use a special header/banner often contain a second lede/abstract summary ",
    )

    # Corresponds to pseudo-field called "About" in some templates
    fw_about_this_article = models.TextField(
        null=False,
        blank=True,
        default='',
        verbose_name='About This Article (Optional)',
    )

    # Timelines
    show_timeline = models.BooleanField(
        default=False,
        help_text="Layout MUST be full-width (or else customized) to display a timeline",
    )
    timeline = models.ForeignKey(
        TimelineSnippet,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="timeline_articles",
        help_text="Create a timeline in the Snippets menu and set it here."
    )
    timeline_date = models.DateTimeField(
        default=timezone.now,
    )

    # Featured image stuff used for tempalte customization
    header_layout = models.CharField(
        null=False,
        blank=False,
        default='right-image',
        max_length=50,
        help_text="Based on from Dispatch's obselete \"Templates\" feature",
    )

    # Keeps track of whether this article has already been automatically shared to https://mstdn.ca/@ubyssey
    posted_to_mastodon = models.BooleanField(
        default = False,
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

        if self.layout == 'fw-story':
            return "article/article_page_fw_story.html"
        elif self.layout == 'guide-2020':
            return "article/article_page_guide_2020.html"
        elif self.layout == 'guide-2022':
            return "article/article_page_guide_2022.html"
        elif self.layout == 'magazine-2023':
            return "article/article_page_magazine_2023.html"
        elif self.layout == 'visual-essay':
            return "article/article_page_visual_essay.html"
                        
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
                HelpPanel(
                    content='<h1>Help: Writing Articles</h1><p>The main contents of the article are organized into \"blocks\". Click the + to add a block. Most article text should be written in Rich Text Blocks, but many other features are available!</p><p>Blocks simply represent units of the article you may wish to re-arrange. You do not have to put every individual paragraph in its own block (doing so is probably time consuming!). Many articles that have been imported into our database DO divide every paragraph into its own block, but this is for computer convenience during the import.</p>'
                ),
                StreamFieldPanel("content"),
            ],
            heading="Article Content",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                FieldPanel("lede")
            ],
            heading="Front Page Stuff",
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
                # FieldPanel("section"),
                SnippetChooserPanel("category"),
                FieldPanel("tags"),
            ],
            heading="Categories and Tags",
            classname="collapsible",
        ),
        MultiFieldPanel(
            [
                InlinePanel("featured_media", label="Featured Image or Video"),
            ],
            heading="Featured Media",
            classname="collapsible",
        ),
    ] + UbysseyMenuMixin.menu_content_panels # content_panels

    promote_panels = Page.promote_panels + [
        MultiFieldPanel(
            [
                HelpPanel(content="\"Breaking Timeout\" is irrelevant if news is not breaking news."),
                FieldPanel("is_breaking"),
                FieldPanel("breaking_timeout"),
            ],
            heading="Breaking",
        ),
        MultiFieldPanel(
            [
                FieldPanel("seo_keyword"),
                FieldPanel("seo_description"),
            ],
            heading="Old Search Engine/SEO stuff",
            help_text="In Dispatch, \"SEO Keyword\" was referred to as \"Focus Keywords\", and  \"SEO Description\" was referred to as \"Meta Description\""
        ),
        MultiFieldPanel(
            [
                FieldPanel("noindex"),
            ],
            heading="Special search engine-related meta tagging",
        )
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
        MultiFieldPanel(
            [
                FieldPanel(
                    'legacy_revision_number',
                    help_text = "DO NOT TOUCH",
                ),
            ],
            heading='Legacy stuff'
        ),
    ] # settings_panels   
    fw_article_panels = [
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
                            ('fw-story', 'Full-Width Story'),
                            ('guide-2020', 'Guide (2020 style - currently broken, last checked 2022/09)'),
                            ('guide-2022', 'Guide (2022 style)'),
                            ('magazine-2023', 'Magazine (2023 style)'),
                            ('visual-essay', 'Visual Essay'),
                        ],
                    ),
                ),
            ],
            heading = "Select Stock Layout",
            classname="collapsible collapsed",
        ), # Select Stock Layout
        MultiFieldPanel(
            [
                HelpPanel(content="<p>This information is generally used in articles that use a full-width banner of some sort.</p>"),
                FieldPanel(
                    "header_layout",
                    widget=Select(
                        choices=[
                            ('right-image', 'Right Image'),
                            ('top-image', 'Top Image'),
                            ('banner-image', 'Banner Image')
                        ],
                    ),
                    help_text='This field is used to set variations on the \"Full-Width Story\" and similar layouts.',
                ),
                FieldPanel('fw_alternate_title'),
                FieldPanel('fw_optional_subtitle'),
                FieldPanel('fw_above_cut_lede'),
            ],
            heading = "Optional Header/Banner Fields",
            classname="collapsible collapsed",
        ), # Optional Header/Banner Fields
        MultiFieldPanel(
            [
                HelpPanel(content='<h1>Warning</h1><p>If a timeline is included in your article, <u>additional processing will be required when the article is saved</u>.</p><p>It is recommended you add a Timeline snippet LAST, <i>after</i> your article is otherwise written.</p><p><u>Developers</u> should note: the Timeline/Article sync is accomplished with Django signals, to prevent tight coupling of the two classes. Do not allow use of signals to turn into noodle logic.</p>'),
                FieldPanel('show_timeline'),
                FieldPanel('timeline_date'),
                SnippetChooserPanel('timeline'),
            ],
            heading = "Timeline",
            classname="collapsible collapsed",
        ), # Timeline
        MultiFieldPanel(
            [
                HelpPanel(content="<p>This information is generally used in a special article that has additional credits beyond the normal byline.</p>"),
                FieldPanel('fw_about_this_article'),
            ],
            heading = "Additional Credits",
            classname="collapsible collapsed",
        ), # Additional Credits
        MultiFieldPanel(
            [
                HelpPanel(content="Somewhat legacy. These will not be used with the majority of templates, but are used with how Magazines or Guides or some special articles have traditionally been set up."),
                InlinePanel("connected_articles"),
            ],
            heading="Connected or Related Article Links (Non-Series)",
            classname="collapsible collapsed",
        ), # Connected or Related Article Links (Non-Series) 
    ] # fw_article_panels
    customization_panels = [
        HelpPanel(
            content="<h1>Help</h1><p>This tab exists so that every aspect of the frontend for an individual article may be customized, down to the finest detail. There are three fundamental tools of frontend web programming - HTML, CSS and JavaScript, and here you may utilize all three.</p><p>Custom HTML templates, which use the Django templating language, should be uploaded not as files/documents but as \"Custom HTML\" in the site admin.\n\n Custom CSS or JavaScript should be uploaded to \"Documents\"</p>"
        ),
        MultiFieldPanel(
            [
                HelpPanel(
                    content="<p>Making a template requires some understanding of how the Django backend works, so that you might know variable names etc. for the data that the template is supposed to render.</p> <p>Because of the potential complexity of a template, it is desirable to be able to quickly switch the article back to a default template. Turn on \"Use default template\" to use the stock template and turn it off to be able to override the default with a custom template. Defaults to \"on\".</p>",
                ),
                FieldPanel("use_default_template"),
                ModelChooserPanel("db_template"),
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
            ObjectList(fw_article_panels, heading='Layout (Stock Templates)'),
            ObjectList(customization_panels, heading='Custom Frontend (Advanced!)'),
        ],
    ) # edit_handler

    #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = Page.search_fields + [
        index.SearchField('lede'),
        index.SearchField('content'),
        
        index.FilterField('current_section'),
        index.FilterField('slug'),
        index.FilterField('explicit_published_at'),

        index.RelatedFields('category', [
            index.FilterField('slug'),
        ]),
        index.RelatedFields('article_authors', [
            index.SearchField('full_name'),
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

        context["suggested"] = self.get_suggested()

        return context


    def get_authors_string(self, links=False, authors_list=[]) -> str:
        """
        Returns html-friendly list of the ArticlePage's authors as a comma-separated string (with 'and' before last author).
        Keeps large amounts of logic out of templates.

          links: Whether the author names link to their respective pages.
        """
        def format_author(article_author):
            if links:
                return '<a href="%s">%s</a>' % (article_author.author.full_url, article_author.author.full_name)
            return article_author.author.full_name

        if not authors_list:
            authors = list(map(format_author, self.article_authors.all()))
        else:
            authors = list(map(format_author, authors_list))
           

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
    

    def get_authors_with_roles(self) -> str:
        """Returns list of authors as a comma-separated string
        sorted by author type (with 'and' before last author)."""

        authors_with_roles = ''
        string_written = ''
        string_photos = ''
        string_author = ''
        string_videos = ''

        authors = dict((k, list(v)) for k, v in groupby(self.article_authors.all(), lambda a: a.author_role))
        for author in authors:
            if author == 'author':
                authors_with_roles += 'Written by ' + self.get_authors_string(links=True, authors_list=authors['author'])
            if author == 'photographer':
                string_photos += 'Photos by ' + self.get_authors_string(links=True, authors_list=authors['photographer'])
            if author == 'illustrator':
                string_author += 'Illustrations by ' + self.get_authors_string(links=True, authors_list=authors['illustrator'])
            if author == 'videographer':
                string_videos += 'Videos by ' + self.get_authors_string(links=True, authors_list=authors['videographer'])
        if string_written != '':
            authors_with_roles += string_written # Unneccessary if statement
        if string_photos != '':
            authors_with_roles += ', ' + string_photos
        if string_author != '':
            authors_with_roles += ', ' + string_author
        if string_videos != '':
            authors_with_roles += ', ' + string_videos
        return authors_with_roles
    authors_with_roles = property(fget=get_authors_with_roles)
 
    def get_category_articles(self, order='-explicit_published_at') -> QuerySet:
        """
        Returns a list of articles within the Article's category
        """
        category_articles = ArticlePage.objects.live().public().filter(category=self.category).not_page(self).order_by(order)

        return category_articles
    
    def get_section_articles(self, order='-explicit_published_at') -> QuerySet:
        """
        Returns a list of articles within the Article's section
        """

        section_articles = ArticlePage.objects.live().public().descendant_of(self.get_parent()).not_page(self).order_by(order)
        
        return section_articles

    def get_suggested(self, number_suggested=6):
        """
        Defines the title and articles in the suggested box
        """
        
        category_articles = self.get_category_articles()
        section_articles = self.get_section_articles()

        if self.category == None or len(category_articles) == 0:
            suggested = {}
            suggested['title'] = "From " + self.get_parent().title
            suggested['articles'] = section_articles[:number_suggested]
        elif len(section_articles) > 0:
            suggested = {}
            suggested['title'] = "From " + self.get_parent().title + " - " + self.category.title
            suggested['articles'] = category_articles[:number_suggested]
        else:
            suggested = False

        return suggested

    def post_to_mastodon(self):
        import requests
        content = self.lede + "\n\n" + self.full_url
        data = { "status": content}

        url = "%s/api/v1/statuses" % "https://mstdn.ca"
        r = requests.post(url,
                data=data,
                headers={'Authorization': 'Bearer %s' % env.mastodon_access_token})


    @property
    def published_at(self):
        if self.explicit_published_at:
            return self.explicit_published_at
        return self.first_published_at
    
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
        verbose_name = "Article"
        verbose_name_plural = "Articles"
        indexes = [
            models.Index(fields=['current_section','last_modified_at']),
            models.Index(fields=['last_modified_at']),
            models.Index(fields=['category',]),
        ]

class SpecialArticleLikePage(ArticlePage):

    show_in_menus_default = True

    parent_page_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'section.SectionPage',
    ]

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
    )

    content_panels = ArticlePage.content_panels + [
        MultiFieldPanel(
            [
                HelpPanel(
                    content=''
                ),
                StreamFieldPanel("right_column_content")
            ],
            heading="Article Right Column Content",
            classname="collapsible",
        ),
    ]

    # This overrides the default Wagtail edit handler, in order to add custom tabs to the article editing interface
    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading='Content'),
            ObjectList(ArticlePage.promote_panels, heading='Promote'),
            ObjectList(ArticlePage.settings_panels, heading='Settings'),
            ObjectList(ArticlePage.fw_article_panels, heading='Layout (Stock Templates)'),
            ObjectList(ArticlePage.customization_panels, heading='Custom Frontend (Advanced!)'),
        ],
    ) # edit_handler
    
    def get_template(self, request):
        if not self.use_default_template:
            if self.db_template:
                return self.db_template.name

        if self.layout == 'fw-story':
            return "article/article_page_fw_story.html"
        elif self.layout == 'guide-2020':
            return "article/article_page_guide_2020.html"
                        
        return "article/article_like_special_page.html"

    class Meta:
        verbose_name = "Special Article-Like Page (for About Page, Contact, etc.)"
        verbose_name_plural = "Articles"