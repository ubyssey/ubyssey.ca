from django.db import models
from django.db.models.query import QuerySet
from django.utils.text import slugify
from django_extensions.db.fields import AutoSlugField
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from article.models import ArticlePage
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
from wagtail.core.models import Page
from wagtail.search import index
from wagtail.images.edit_handlers import ImageChooserPanel



class AllAuthorsPage(Page):
    subpage_types = [
        'authors.AuthorPage',
    ]
    parent_page_types = [
        'home.HomePage',
    ]
    max_count_per_parent = 1
    class Meta:
        verbose_name = "Author Management"
        verbose_name_plural = "Author Management Pages"

class AuthorPage(Page):

    template = "authors/author_page.html"

    parent_page_types = [
        'authors.AllAuthorsPage',
    ]
    full_name = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    image = models.ForeignKey(
        "images.UbysseyImage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    ubyssey_role = models.CharField(
        max_length=255,
        null=False,
        blank=True,
        default='',
        verbose_name='Role at The Ubyssey',
    )
    facebook_url = models.URLField(
        null=True,
        blank=True,
    )
    twitter_url = models.URLField(
        null=True,
        blank=True,
    )
    legacy_facebook_url = models.CharField(max_length=255, null=False, blank=True, default='')
    legacy_twitter_url = models.CharField(max_length=255, null=False, blank=True, default='')
    legacy_slug = models.CharField(
        max_length=255,
        blank=True,
        null=False,
        default='',
    )

    bio_description =  models.TextField(
        null=False,
        blank=True,
        default='',
    )

    short_bio_description = models.TextField(
        null=False,
        blank=True,
        default='',
        help_text="Please provide your title, year and program"
    )

   
    # For editting in wagtail:
    content_panels = [
        # title not present, title should NOT be directly editable
        FieldPanel("full_name"),
        MultiFieldPanel(
            [
                ImageChooserPanel("image"),
                FieldPanel("ubyssey_role"),
                StreamFieldPanel("bio_description"),
                StreamFieldPanel("short_bio_description"),
                FieldPanel("facebook_url"),
                FieldPanel("twitter_url"),
            ],
            heading="Optional Stuff",
        ),
    ]
    #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = Page.search_fields + [
        index.SearchField('full_name'),
        index.SearchField('description'),
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

        # Hit the db
        authors_articles = ArticlePage.objects.live().public().filter(article_authors__author=self).order_by(article_order)
        if search_query:
            context["search_query"] = search_query
            authors_articles = authors_articles.search(search_query)

        # Paginate all posts by 15 per page
        paginator = Paginator(authors_articles, per_page=15)
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
    
   
    def clean(self):
        """Override the values of title and slug before saving."""
        # The odd pattern used here was taken from: https://stackoverflow.com/questions/48625770/wagtail-page-title-overwriting
        # This is to treat the full_name as the "title" field rather than the usual Wagtail pattern of 

        super().clean()
        self.title = self.full_name
        # self.slug = slugify(self.full_name)  # slug MUST be unique & slug-formatted

    def __str__(self):
        return self.full_name
    
    class Meta:
        verbose_name = "Author"
        verbose_name_plural = "Authors"