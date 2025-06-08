from django.db.models.query import QuerySet
from .sectionable.models import SectionablePage

from article.models import ArticlePage
from home import blocks as homeblocks
from article import blocks_outer_article
from article import blocks_inner_article
from ubyssey import blocks as general_blocks

from django.core.cache import cache
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import models
from django.db.models.fields import CharField, BooleanField, TextField, SlugField
from django.db.models.fields.related import ForeignKey
from django.shortcuts import render

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

class SectionPage(RoutablePageMixin, SectionablePage):
    template = 'section/section_page.html'

    subpage_types = [
        'article.ArticlePage',
        'article.SpecialArticleLikePage',
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

    label_svg = models.ForeignKey(
        'wagtaildocs.Document',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )

    top_stream = StreamField(
        [
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
        
        # context["featured_articles"] = self.get_featured_articles()

        if search_query:
            context["search_query"] = search_query
    
        return context
    
    def get_section_articles(self, order='-first_published_at') -> QuerySet:
        # order should be explicit_published_at but that is in the ArticlePage table and accessing slows down the query
        section_articles = ArticlePage.objects \
            .child_of(self) \
            .order_by(order) \
            .live()
        
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
    
    def get_recent_topic_cluster(self, items=12, max_in_cluster=3, cut_off=timezone.now() - timezone.timedelta(days=60)):
        '''
        Cluster articles by their topic. The clustering works by iterating
        from the most recent article and selecting a unique primary or listed topic. These topics are
        then iterated through and recent articles with these topics are joined in a cluster
        '''
        
        # Get recent articles to cluster
        considered_articles = ArticlePage.objects.live().child_of(self).filter(first_published_at__gte=cut_off).order_by('-first_published_at')[:2*items]
        
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
        for topic in used_topics:
            articles_in_topic = list(filter(lambda considered_article: topic in considered_article["topics"], article_topics))
            
            cluster_articles = []
            for article_topic in articles_in_topic:
                article = article_topic["article"]
                if not article in seen_articles:
                    cluster_articles.append(article)
                    seen_articles.append(article)
                    if len(seen_articles) >= items or len(cluster_articles) >= max_in_cluster:
                        break
            if len(cluster_articles) > 0:
                cluster.append({"topic": topic, "articles": cluster_articles})
            if len(seen_articles) >= items:
                break

        #for clust in cluster:
        #    print(clust["topic"].name)
        #    for article in clust["articles"]:
        #        print(" - " + article.title)
        return cluster

    def get_recent_topic_cluster_grouped(self, items=12, columns=4, group_max=3, cut_off=timezone.now() - timezone.timedelta(days=60)):
        '''
        Divide the topic clusers into groups where each group has 'group_max' number of articles.
        '''
        
        # Get clusters
        clusters = self.get_recent_topic_cluster(items=items+columns, max_in_cluster=group_max, cut_off=cut_off)
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

     