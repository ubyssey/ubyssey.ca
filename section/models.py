from django.db.models.query import QuerySet
from .sectionable.models import SectionablePage

from article.models import ArticlePage

from django.core.cache import cache
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import models
from django.db.models.fields import CharField, BooleanField, TextField, SlugField
from django.db.models.fields.related import ForeignKey
from django.shortcuts import render

from modelcluster.models import ClusterableModel
from modelcluster.fields import ParentalKey


from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel, PageChooserPanel
from wagtail.core import models as wagtail_core_models
from wagtail.core.models import Page
from wagtail.contrib.routable_page.models import route, RoutablePageMixin
from wagtail.search import index
from wagtail.snippets.edit_handlers import SnippetChooserPanel
from wagtail.snippets.models import register_snippet


#-----Snippet models-----
@register_snippet
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
    # authors = ManyToManyField('Author', related_name='subsection_authors')
    is_active = BooleanField( # legacy field
        default=False
    )
    section_page = ParentalKey(
        "section.SectionPage",
        related_name="categories",
    )
    search_fields = [
        index.SearchField('title', partial_match=True),
    ]

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("title"),
                FieldPanel("slug"),
                PageChooserPanel("section_page"),
                FieldPanel("description"),
            ],
            heading="Essentials"
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
        PageChooserPanel("author"),
    ]

class CategoryMenuItem(wagtail_core_models.Orderable):
    category = ForeignKey(
        "section.CategorySnippet",
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
        SnippetChooserPanel("category"),
    ]

class SectionPage(RoutablePageMixin, SectionablePage):
    template = 'section/section_page.html'

    subpage_types = [
        'article.ArticlePage',
        'article.SpecialArticleLikePage',
        'specialfeaturelanding.SpecialLandingPage',
    ]
    parent_page_types = [
        'home.HomePage',
    ]

    show_in_menus_default = True

    content_panels = wagtail_core_models.Page.content_panels + [
        MultiFieldPanel(
            [
                InlinePanel("category_menu"),
            ],
            heading="Category Menu",
        ),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        search_query = request.GET.get("q")
        page = request.GET.get("page")
        order = request.GET.get("order")

        if order == 'oldest':
            article_order = "explicit_published_at"
        else:            
            article_order = "-explicit_published_at"
        context["order"] = order

        all_articles = self.get_section_articles(order=article_order)
        if 'category_slug' in kwargs:            
            category_articles = all_articles.filter(category__slug=kwargs['category_slug'])
            context["category_articles"] = category_articles
        else:
            category_articles = None

        context["featured_articles"] = self.get_featured_articles()

        if search_query:
            context["search_query"] = search_query
            all_articles = all_articles.search(search_query)

        # Paginate all posts by 154 per page
        paginator = Paginator(all_articles, per_page=15)       
        try:
            # If the page exists and the ?page=x is an int
            paginated_articles = paginator.page(page)
            context["current_page"] = page

        except PageNotAnInteger:
            # If the ?page=x is not an int; show the first page
            paginated_articles = paginator.page(1)
           
        except EmptyPage:
            # If the ?page=x is out of range (too high most likely)
            # Then return the last page
            paginated_articles = paginator.page(paginator.num_pages)

        context["paginated_articles"] = paginated_articles #this object is often called page_obj in Django docs, but Page means something else in Wagtail
    
        return context
    
    def get_section_articles(self, order='-explicit_published_at') -> QuerySet:
        # return ArticlePage.objects.from_section(section_root=self)
        section_articles = ArticlePage.objects.live().public().filter(current_section=self.slug).order_by(order)
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

    @route(r'^category/(?P<category_slug>[-\w]+)/$', name='category_view')
    def category_view(self, request, category_slug):
        context = self.get_context(request, category_slug=category_slug)
        print(context)
        return render(request, 'section/category_page.html', context)


    def save(self, *args, **kwargs):
        self.current_section = self.slug
        return Page.save(self,*args, **kwargs)

    class Meta:
        verbose_name = "Section"
        verbose_name_plural = "Sections"
