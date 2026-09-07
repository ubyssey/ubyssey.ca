from django.db.models.query import QuerySet
from .sectionable.models import SectionablePage

from article.models import ArticlePage
from home import blocks as homeblocks
from article import blocks_outer_article
from article import blocks_inner_article
from section import blocks as section_blocks
from ubyssey import blocks as general_blocks

from django.core.cache import cache
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.fields import CharField, BooleanField, TextField, SlugField
from django.db.models.fields.related import ForeignKey
from django.shortcuts import render
from django import forms

from modelcluster.models import ClusterableModel
from modelcluster.fields import ParentalKey


from wagtail.admin.panels import TitleFieldPanel, FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.fields import StreamField, RichTextField
from wagtail import models as wagtail_core_models
from wagtail.models import Page
from wagtail.contrib.routable_page.models import route, RoutablePageMixin
from wagtail.search import index

from wagtail.snippets.models import register_snippet

from wagtail_color_panel.fields import ColorField
from wagtail_color_panel.edit_handlers import NativeColorPanel

from wagtail.documents.models import Document


from home import blocks as homeblocks
from infinitefeed import blocks as infinitefeedblocks


import datetime
from django.utils import timezone

from topics.views import cluster_articles_by_topic


#-----Snippet models-----
class CategorySnippet(index.Indexed, ClusterableModel):
    """
    Formerly known as a 'Subsection'
    """
    title = CharField(
        blank=False,
        null=False,
        max_length=100
    )
    slug = SlugField(
        unique=True,
        blank=False,
        null=False,
        max_length=100
    )
    description = TextField(
        null=False,
        blank=True,
        default='',
    )

    banner = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='categoryBanner',
    )

    # authors = ManyToManyField('Author', related_name='subsection_authors')
    is_active = BooleanField( # legacy field
        default=False
    )
    section_page = ParentalKey(
        "section.SectionPage",
        related_name="categories",
    )
    search_fields = [
        index.AutocompleteField('title'),
    ]

    panels = [
        MultiFieldPanel(
            [
                TitleFieldPanel("title"),
                FieldPanel("slug"),
                FieldPanel("section_page"),
                FieldPanel("description"),
            ],
            heading="Essentials"
        ),
        MultiFieldPanel(
            [
                FieldPanel("banner"),
            ],
            heading="Banner",
        ),
        MultiFieldPanel(
            [
                InlinePanel("category_authors"),
            ],
            heading="Category Author(s)"
        ),
    ]
    def __str__(self):
        return "%s - %s" % (self.section_page, self.title)
    
    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"

#-----Orderable models-----
class CategoryAuthor(wagtail_core_models.Orderable):
    author = ForeignKey(
        "authors.AuthorPage",
        blank=False,
        null=False,
        on_delete=models.CASCADE,
    )
    category = ParentalKey(
        CategorySnippet,
        blank=True,
        null=True,
        related_name="category_authors",
    )
    panels = [
        FieldPanel("author"),
    ]

class CategoryMenuItem(wagtail_core_models.Orderable):
    category_page = ForeignKey(
        "section.CategoryPage",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )
    section = ParentalKey(
        "section.SectionPage",
        blank=True,
        null=True,
        related_name="category_menu",
    )
    panels = [
        FieldPanel("category_page"),
    ]

    def clean(self):
        super().clean()
        if not self.category_page_id or not self.section_id:
            return
        # A beat is a child CategoryPage. Allowing a category from another
        # section would make a tab silently take readers to the wrong feed.
        if self.category_page.get_parent().id != self.section_id:
            raise ValidationError({
                "category_page": "Choose a beat (Category page) that belongs directly to this section."
            })


class SectionRedesignFeaturedArticle(wagtail_core_models.Orderable):
    section_page = ParentalKey(
        "section.SectionPage", related_name="redesign_featured_articles", on_delete=models.CASCADE
    )
    article = ForeignKey(
        "article.ArticlePage", null=False, blank=False, on_delete=models.CASCADE, related_name="+"
    )

    panels = [FieldPanel("article")]

    class Meta:
        ordering = ("sort_order",)
        verbose_name = "Featured redesign story"
        verbose_name_plural = "Featured redesign stories"

class SectionPage(RoutablePageMixin, SectionablePage):
    template = 'section/section_page.html'

    subpage_types = [
        'article.StandardArticlePage',
        'article.StandardArticlePageWithRightColumn',
        'article.SpecialArticleLikePage',
        'liveblog.LiveBlogArticlePage',
        'specialfeaturelanding.SpecialLandingPage',
        'section.CategoryPage',
    ]
    parent_page_types = [
        'home.HomePage',
    ]

    show_in_menus_default = True

    banner = models.ForeignKey(
        "images.UbysseyImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='banner',
    )

    description = RichTextField(
        # Was called "snippet" in Dispatch - do not want to reuse this work, so we call it 'lede' instead
        null=False,
        blank=True,
        default='',
    )

    spotify_episode_url = models.URLField(
        blank=True,
        default="",
        help_text=(
            "For The Vilest Rag landing page: paste the public Spotify episode URL "
            "used by the Latest Episode player. No iframe markup is required."
        ),
    )

    redesign_tip_title = models.CharField(max_length=100, blank=True, default="")
    redesign_tip_body = models.TextField(blank=True, default="")
    redesign_tip_link_text = models.CharField(max_length=50, blank=True, default="")
    redesign_tip_link_url = models.URLField(blank=True, default="")
    redesign_editor = models.ForeignKey(
        "authors.AuthorPage", null=True, blank=True, on_delete=models.SET_NULL, related_name="edited_redesign_sections"
    )
    redesign_editor_description = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text="Custom copy for the Contact the editor box. This does not use the editor's author-profile bio.",
    )

    label_svg = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )

    top_stream = StreamField(
        [
            ('section_heading', section_blocks.SectionHeading()),
            ('section_category_bar', section_blocks.SectionCategoryBar()),
            ('article_gatherer', blocks_outer_article.ArticleGathererBlock()),
            ('landing', blocks_outer_article.SpecialLandingPageBlock()),
            ('article_manual', blocks_outer_article.ManualArticles()),
            ('article_gatherer_with_pinned', blocks_outer_article.ArticleGathererWithPinnedBlock()),
            ('grouped_articles_manual', blocks_outer_article.ManualArticleLinkGroup()),
            ('header_menu', blocks_inner_article.HeaderMenuBlock()),
            ('info', general_blocks.LandingStreamInfo()),
        ],
        null=True,
        blank=True,
        use_json_field=True,
    )

    sidebar_stream = StreamField(
    [
        ("sidebar_advertisement_block", infinitefeedblocks.SidebarAdvertisementBlock()),
        ("sidebar_issues_block", infinitefeedblocks.SidebarIssuesBlock()),
        ("sidebar_flex_stream_block", infinitefeedblocks.SidebarFlexStreamBlock()),
        ("sidebar_gatherer_block", infinitefeedblocks.SidebarArticleGatherer()),
        ("sidebar_manual", infinitefeedblocks.SidebarManualArticles()),
        ('siderbar_info', infinitefeedblocks.SidebarInfo()),
    ],
    null=True,
    blank=True,
    use_json_field=True,
    )

    content_panels = wagtail_core_models.Page.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("banner"),
            ],
            heading="Banner",
        ),
        MultiFieldPanel(
            [
                FieldPanel("description"),
            ],
            heading="Description",
        ),
        MultiFieldPanel(
            [
                FieldPanel("redesign_tip_title"), FieldPanel("redesign_tip_body"),
                FieldPanel("redesign_tip_link_text"), FieldPanel("redesign_tip_link_url"),
                FieldPanel("redesign_editor"),
                FieldPanel("redesign_editor_description", widget=forms.TextInput(attrs={"maxlength": 120})),
                InlinePanel("redesign_featured_articles", max_num=3, label="Story"),
            ],
            heading="Redesign section page",
            help_text="Add all three featured stories in display order: centre, upper-right, then lower-right.",
        ),
        MultiFieldPanel(
            [FieldPanel("spotify_episode_url")],
            heading="Podcast player",
            classname="collapsible collapsed",
        ),
        MultiFieldPanel(
            [
                FieldPanel("top_stream"),
            ],
            heading="Top stream"
        ),
        MultiFieldPanel(
            [
                FieldPanel('label_svg'),
            ],
            heading="Label svg"
        ),
        MultiFieldPanel(
            [
                InlinePanel("category_menu"),
            ],
            heading="Category Menu",
            help_text="Add this section's beat pages in navigation order. Each beat opens its own filtered story feed.",
        ),
        MultiFieldPanel(
            [
                FieldPanel("sidebar_stream"),
            ],
            heading="Sidebar"
        )
    ]

    def get_filter(self):
        filters = {"section": self.current_section}
        return filters

    def clean(self):
        super().clean()
        if len(self.redesign_editor_description or "") > 120:
            raise ValidationError({
                "redesign_editor_description": "Keep the Contact the editor description to 120 characters or fewer."
            })
    filter = property(fget=get_filter) 

    def get_all_categories(self):
        def get_academic_year(date):
            academic_year = "Unknown"
            if date != None:
                if date.month > 4:
                    academic_year = str(date.year) + "/" + str(date.year+1)[-2:]
                else:
                    academic_year = str(date.year-1) + "/" + str(date.year)[-2:]
            return academic_year
        
        categories_filter_value = lambda category: ArticlePage.objects.live().filter(category_page=category).exists()
        categories_order_value = lambda category: datetime.datetime.min if ArticlePage.objects.live().filter(category_page=category).order_by("-first_published_at")[0].published_at == None else ArticlePage.objects.live().filter(category_page=category).order_by("-first_published_at")[0].published_at.replace(tzinfo=None)
        categories = list(CategoryPage.objects.live().child_of(self))
        categories = list(filter(categories_filter_value, categories))
        categories = list(map(lambda c: [categories_order_value(c), c], categories))
        categories.sort(key=lambda c: c[0], reverse=True)

        category_groups = {}
        current = get_academic_year(datetime.datetime.now())
        for category in categories:
            group = "Unknown"
            if category[0] != datetime.datetime.min:
                group = get_academic_year(category[0])
            if group == current:
                group = "Current"
            
            if group in category_groups:
                category_groups[group].append(category[1])
            else:
                category_groups[group] = [category[1]]
        category_groups = list(map(lambda k: {"group": k, "categories": category_groups[k]}, category_groups.keys()))
        return category_groups
    all_categories = property(fget=get_all_categories)

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        search_query = request.GET.get("q")

        filters = self.filter

        if search_query:
            filters["search_query"] = search_query

        context["filters"] = filters
        context["section_slug"] = self.slug
        configured_beats = [
            item.category_page.specific
            for item in self.category_menu.select_related("category_page").all()
            if item.category_page
        ]
        # An explicit Category Menu gives editors control over the order. For
        # older sections without one, every live child beat remains visible so
        # the redesign cannot silently lose their navigation.
        if not configured_beats:
            configured_beats = [category.specific for category in CategoryPage.objects.live().child_of(self)]
        context["redesign_topics"] = [
            {"title": beat.title, "url": beat.get_url(request)}
            for beat in configured_beats
        ]
        configured_featured = list(self.redesign_featured_articles.select_related("article").all())
        if len(configured_featured) == 3:
            featured = [item.article.specific for item in configured_featured]
            feed = self.get_section_articles().exclude(pk__in=[article.pk for article in featured])
            context["redesign_featured"] = featured
            context["redesign_featured_ids"] = ",".join(str(article.pk) for article in featured)
            context["redesign_recent_articles"] = feed[:20]
        else:
            featured = list(self.get_featured_articles(number_featured=3))
            feed = self.get_section_articles()
            context["redesign_featured_ids"] = ""
            # The legacy automatic hero contains the first three stories, so
            # the initial feed begins at story four and the next request starts
            # at 20 in the same unfiltered query.
            context["redesign_recent_articles"] = feed[3:20]
        # Auxiliary section templates (Photo, Margins, and Podcast) use this
        # complete feed rather than the curated hero/feed split above.
        # Supplying it here keeps those pages populated regardless of whether
        # a section has configured featured stories.
        context["redesign_all_articles"] = self.get_section_articles()
        # The initial feed and the deferred request use the exact same query,
        # so curated stories never repeat in the infinite list.
        context["redesign_editor"] = self.redesign_editor
        
        # context["featured_articles"] = self.get_featured_articles()

        if search_query:
            context["search_query"] = search_query
    
        return context

    def get_template(self, request, *args, **kwargs):
        """Use the canonical auxiliary-page variants without changing old page types."""
        templates = {
            "photo": "section/photo_page.html",
            "margins": "section/margins_page.html",
            "the-vilest-rag": "section/podcast_page.html",
        }
        return templates.get(self.slug, self.template)

    def get_section_articles(self, order='-explicit_published_at') -> QuerySet:
        """Published stories in the same order used by the redesigned feed."""
        section_articles = ArticlePage.objects \
            .live() \
            .public() \
            .descendant_of(self) \
            .order_by(order, '-id')
        
        return section_articles

    def get_featured_articles(self, queryset=None, number_featured=4) -> QuerySet:
        """
        Returns a truncated queryset of articles
            queryset: if not included, will default to all live, public, ArticlePage descendents of this SectionPage
            number_featured: defaults to 4 as brute fact about our template's design
        """
        if queryset == None:
            # queryset = ArticlePage.objects.from_section(section_root=self)
            queryset = self.get_section_articles()
        return queryset[:number_featured]    
    featured_articles = property(fget=get_featured_articles)

    def get_recent_articles(self, max_items=10):
        return ArticlePage.objects.live().child_of(self).order_by("-first_published_at")[:max_items]
    
    def get_recent_topic_cluster(self, items=12, max_in_cluster=3):
        '''
        Cluster articles by their topic. The clustering works by iterating
        from the most recent article and selecting a unique primary or listed topic. These topics are
        then iterated through and recent articles with these topics are joined in a cluster
        '''

        #considered_articles = ArticlePage.objects.live().child_of(self).order_by('-first_published_at')[:2*items]

        #return cluster_articles_by_topic(considered_articles, items=items, max_in_cluster=max_in_cluster)


        # Get recent articles to cluster
        considered_articles = ArticlePage.objects.live().child_of(self).order_by('-first_published_at')[:2*items]
        
        # Get the topics of all these articles
        article_topics = [
            {
                "article": article,
                "topics": article.topics.all()
            }
            for article in considered_articles
        ]

        # Iterate through articles and select a topic to represent it
        used_topics = []
        for article_topic in article_topics:
            article = article_topic["article"]

            # Use the primary topic if multiple recent articles are tagged with it
            primary_topic = article.get_primary_topic()
            if primary_topic and not primary_topic in used_topics:
                possible_articles = list(filter(lambda article: primary_topic in article["topics"], 
                                                   article_topics))
                if len(possible_articles) > 1:
                    used_topics.append(primary_topic)
                    continue

            # Get the number of recent articles tagged by topic tagged by this article
            possible_topics = [
                {
                    "topic": topic,
                    "count": len(list(filter(lambda considered_article: topic in considered_article["topics"], article_topics)))
                }
            for topic in article_topic["topics"]]
            
            # Remove topics that aren't listed or tagged with multiple articles
            possible_topics = list(filter(lambda topic: topic["count"] > 1 and topic["topic"].listed, possible_topics))
            
            # If the there are no listed topics that are tagged with multiple aritcles, then use the primary topic 
            if primary_topic:
                if len(possible_topics) == 0 and not primary_topic in used_topics:
                    used_topics.append(primary_topic)
                    continue
        
            # Use the first unique listed topic with the lowest number of tagged articles greater than 1  
            possible_topics = sorted(possible_topics, key=lambda topic: topic["count"])
            for topic in possible_topics:
                if not topic["topic"] in used_topics:
                    used_topics.append(topic["topic"])
                    break

        # Iterate through the collected topics in the order they were added at.
        # We gather the articles under these topics, avoiding articles we have already gathered. 
        seen_articles = []
        cluster = []

        articles_by_topic = {}
        for topic in used_topics:
            articles_by_topic[topic.name] = list(filter(lambda considered_article: topic in considered_article["topics"], article_topics))
            articles_by_topic[topic.name] = list(map(lambda a: a["article"], articles_by_topic[topic.name]))

        while len(used_topics) > 0:
            topic = used_topics[0]
            articles_in_topic = articles_by_topic[topic.name]
            
            cluster_articles = []
            for article in articles_in_topic:
                cluster_articles.append(article)
                seen_articles.append(article)
                if len(seen_articles) >= items or len(cluster_articles) >= max_in_cluster:
                    break

            if len(cluster_articles) > 0:
                cluster.append({"topic": topic, "articles": cluster_articles})
            if len(seen_articles) >= items:
                break

            used_topics.pop(0)
            for topic in used_topics:
                articles_by_topic[topic.name] = list(filter(lambda article: not article in seen_articles, articles_by_topic[topic.name]))
            
            used_topics = list(filter(lambda t: len(articles_by_topic[t.name]) > 0, used_topics))
            used_topics = sorted(used_topics, key=lambda t: articles_by_topic[t.name][0].published_at, reverse=True)

        #for clust in cluster:
        #    print(clust["topic"].name)
        #    for article in clust["articles"]:
        #        print(" - " + article.title)
        return cluster

    def get_recent_topic_cluster_grouped(self, items=12, columns=4, group_max=3):
        '''
        Divide the topic clusers into groups where each group has 'group_max' number of articles.
        '''
        
        # Get clusters
        clusters = self.get_recent_topic_cluster(items=items+columns, max_in_cluster=group_max)
        groups = []

        # Iterate through clusters, first adding 'columns' number to 'groups', 
        # then iterating back over 'groups' to fill in each group so that they include 'group_max' number of articles.
        for cluster in clusters:
            if len(groups) < columns:
                if len(groups) > 0:
                    length = sum(map(lambda cluster: len(cluster["articles"]), groups[-1]))
                    if length + len(cluster["articles"]) <= group_max:
                        groups[-1].append(cluster)
                        continue
                groups.append([cluster])
            else:
                is_perfect = True
                for group in groups:
                    length = sum(map(lambda cluster: len(cluster["articles"]), group))
                    if length < group_max:
                        is_perfect = False
                        cluster["articles"] = cluster["articles"][:group_max - length]
                        group.append(cluster)
                        break
                if is_perfect:
                    break
        return groups
        
    @route(r'^rss/$', name='rss_view')
    def rss_view(self, request):
        from ubyssey.views.feed import SectionFeed
        return SectionFeed().__call__(request, section=self)

    def save(self, *args, **kwargs):
        self.current_section = self.slug
        return Page.save(self,*args, **kwargs)
    
    class Meta:
        verbose_name = "Section"
        verbose_name_plural = "Sections"

class CategoryPage(SectionPage):
    template = 'section/section_page.html'

    parent_page_types = [
        'section.SectionPage',
    ]
    subpage_types = []

    beat = BooleanField(
        default=False
    )

    content_panels = SectionPage.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel('beat'),
            ],
            heading="Beat"
        )
    ]

    def get_filter(self):
        filters = {"section": self.get_parent().slug, "category": self.slug}
        return filters
    filter = property(fget=get_filter)

    def get_all_categories(self):
        return self.get_parent().specific.get_all_categories()
    all_categories = property(fget=get_all_categories)

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["parent"] = self.get_parent()
        context["section_slug"] = context["parent"].slug
        return context
    
    def get_recent_articles(self, max_items=10):
        return ArticlePage.objects.live().filter(category_page = self).order_by("-first_published_at")[:max_items]
