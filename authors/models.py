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
from wagtail.core.models import Page, Orderable
from wagtail.search import index
from wagtail.images.edit_handlers import ImageChooserPanel
from modelcluster.fields import ParentalKey
from wagtail.contrib.routable_page.models import RoutablePageMixin, route
from django.shortcuts import render
from images.models import UbysseyImage
from django import forms
from videos.models import VideoSnippet

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

class PinnedArticlesOrderable(Orderable):
    author_page = ParentalKey(
        "authors.AuthorPage",
        related_name="pinned_articles",
    )
    article = models.ForeignKey(
        'article.ArticlePage',
        on_delete=models.CASCADE,
        related_name="pinned_articles",
    )

    panels = [
        MultiFieldPanel(
            [
                PageChooserPanel('article'),
            ],
            heading="Article"
        ),
    ]

class AuthorPage(RoutablePageMixin, Page):

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

    display_image = models.BooleanField(
        default=False,
        verbose_name="Present Author's Image",
        help_text = "Do you want to display the author's image on the short bio in the article page?"
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

   

    CHOICES = [("stories", "Stories"), ("photos", "Photos"), ("videos", "Videos")]
    main_media_type = models.CharField(
        choices=CHOICES,
        default='stories',
        max_length=20,
        blank=False,
        null=False,)

    linkIcons = StreamField([('raw_html', blocks.RawHTMLBlock()),], blank=True)
    links = StreamField([('url', blocks.URLBlock(label="Url")),], blank=True)

    # For editting in wagtail:
    content_panels = [
        # title not present, title should NOT be directly editable
        FieldPanel("full_name"),
        MultiFieldPanel(
            [
                ImageChooserPanel("image"),
                FieldPanel("display_image"),
            ],
            heading="Image"
        ),
        MultiFieldPanel(
            [
                FieldPanel("ubyssey_role"),
                StreamFieldPanel("bio_description"),
                StreamFieldPanel("short_bio_description"),
                FieldPanel("main_media_type"),
                StreamFieldPanel("links"),
                InlinePanel("pinned_articles", label="Pinned articles")
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

    def organize_media(self, media_type, request, context):
        search_query = request.GET.get("q")
        page = request.GET.get("page")
        order = request.GET.get("order")

        if media_type == "stories":
            if order == 'oldest':
                article_order = "explicit_published_at"
            else:            
                article_order = "-explicit_published_at"
            authors_media = ArticlePage.objects.live().public().filter(article_authors__author=self).order_by(article_order)
        elif media_type == "photos":
            if order == 'oldest':
                article_order = "updated_at"
            else:            
                article_order = "-updated_at"
            authors_media = UbysseyImage.objects.filter(author=self).order_by(article_order)
        elif media_type == "videos":
            if order == 'oldest':
                article_order = "updated_at"
            else:            
                article_order = "-updated_at"
            authors_media = VideoSnippet.objects.filter(video_authors__author=self).order_by(article_order)

        if search_query:
            if media_type == "videos":
                #from wagtail.search.backends import get_search_backend
                #s = get_search_backend()
                #authors_media = s.search(search_query, authors_media)
                authors_media = authors_media.filter(title=search_query)
            else:
                authors_media = authors_media.search(search_query)

        # Paginate all posts by 15 per page
        paginator = Paginator(authors_media, per_page=15)
        try:
            # If the page exists and the ?page=x is an int
            paginated_articles = paginator.page(page)
            context["current_page"] = page
        except PageNotAnInteger:
            # If the ?page=x is not an int; show the first page
            paginated_articles = paginator.page(1)
            context["current_page"] = 1
        except EmptyPage:
            # If the ?page=x is out of range (too high most likely)
            # Then return the last page
            paginated_articles = paginator.page(paginator.num_pages)
            context["current_page"] = paginator.num_pages

        context["paginated_articles"] = paginated_articles

        return context

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        
        media_types = []
        if VideoSnippet.objects.all().count() > 0:
            media_types.append("videos")
        if UbysseyImage.objects.all().count() > 0:
            media_types.append("photos")
        if ArticlePage.objects.live().public().all().count() > 0:
            media_types.append("stories")

        context["media_types"] = media_types
        context["media_type"] = self.main_media_type

        context = self.organize_media(self.main_media_type, request, context)

        return context
    
    def save(self, *args, **kwargs):
        import requests
        from urllib.parse import urlparse
        from django.utils.safestring import mark_safe
        
        domainToIcon = {'www.tumblr.com': 'fa-tumblr',
                        'www.instagram.com': 'fa-instagram',
                        'twitter.com': 'fa-twitter',
                        'www.facebook.com': 'fa-facebook',
                        'www.youtube.com': 'fa-youtube-play',
                        'www.tiktok.com': 'fa-tiktok',
                        'www.linkedin.com': 'fa-linkedin',
                        'www.reddit.com': 'fa-reddit'}

        for i in range(len(self.linkIcons)):
            del self.linkIcons[-1]

        for link in self.links:
            url = link.value
            domain = urlparse(url).netloc    
            extra = ""
            if domain in domainToIcon:
                if domain == "www.linkedin.com":
                    username = self.full_name
                else:
                    icon = domainToIcon[domain]
                    if url[-1] == "/":
                        url = url[0:-1]
                    username = url.split("/")[-1]
                    username = username.replace("@","")
            else:
                icon = "fa-globe"
                try:
                    json = requests.get(urlparse(url).scheme + "://" + domain + "/api/v2/instance").json()
                    if 'source_url' in json:
                        if json['source_url']=='https://github.com/mastodon/mastodon':
                            icon = "fa-brands fa-mastodon"    
                            extra = "rel='me'"
                            username = url.split("/")[-1]
                            username = username.replace("@","")
                except:
                    icon = "fa-globe"
                    username = domain

            self.linkIcons.append(('raw_html', '<a ' + extra + 'class="social_media_links" href="'+url+'"><i class="fa ' + icon + ' fa-fw" style="font-size:1em;"></i>&nbsp;'+username+'</a>'))
            
        return super().save(*args, **kwargs)

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

    @route(r'^stories/$')
    def stories_page(self, request, *args, **kwargs):
        """
        View function for author's stories
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "stories"

        context = self.organize_media("stories", request, context)

        return render(request, self.template, context)
    
    @route(r'^photos/$')
    def photos_page(self, request, *args, **kwargs):
        """
        View function for author's photos
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "photos"
        
        context = self.organize_media("photos", request, context)

        return render(request, self.template, context)
    
    @route(r'^videos/$')
    def videos_page(self, request, *args, **kwargs):
        """
        View function for author's videos
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "videos"
        
        context = self.organize_media("videos", request, context)

        return render(request, self.template, context)