from django.db import models
from django.db.models.query import QuerySet
from videos.models import VideoAuthorsOrderable
from django.db.models import Q
from django.utils.text import slugify
from django_extensions.db.fields import AutoSlugField
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from article.models import ArticlePage, ArticleAuthorsOrderable
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
)


from wagtail import blocks
from wagtail.fields import StreamField
from wagtail.models import Page, Orderable
from wagtail.search import index
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
                FieldPanel('article'),
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
        help_text="Please give a short bio in third person"
    )

   

    CHOICES = [("articles", "Articles"), ("photos", "Photos"), ("videos", "Videos"), ('visual-bylines', "Visual Bylines")]
    main_media_type = models.CharField(
        choices=CHOICES,
        default='articles',
        max_length=20,
        blank=False,
        null=False,)

    linkIcons = StreamField([('raw_html', blocks.RawHTMLBlock()),], blank=True, use_json_field=True)
    links = StreamField([('url', blocks.URLBlock(label="Url")),], blank=True, use_json_field=True)

    # This is so we can list authors in the authors chooser by activity
    last_activity = models.DateTimeField(
        null=True,
        blank=True,
    )

    # For editting in wagtail:
    content_panels = [
        # title not present, title should NOT be directly editable
        FieldPanel("full_name"),
        MultiFieldPanel(
            [
                FieldPanel("image"),
                FieldPanel("display_image"),
            ],
            heading="Image"
        ),
        MultiFieldPanel(
            [
                FieldPanel("ubyssey_role"),
                FieldPanel("bio_description"),
                FieldPanel("short_bio_description"),
                FieldPanel("main_media_type"),
                FieldPanel("links"),
                InlinePanel("pinned_articles", label="Pinned articles")
            ],
            heading="Optional Stuff",
        ),
    ]
    #-----Search fields etc-----
    #See https://docs.wagtail.org/en/stable/topics/search/indexing.html
    search_fields = Page.search_fields + [
        index.SearchField('full_name'),
        index.AutocompleteField("full_name", partial_match=True),
        index.AutocompleteField("slug", partial_match=True),
        index.AutocompleteField("ubyssey_role", partial_match=True),
        index.AutocompleteField('bio_description'),
        index.SearchField("slug"),
        index.SearchField('bio_description'),
        index.SearchField("ubyssey_role"),
    ]

    def organize_media(self, media_type, request, context):
        search_query = request.GET.get("q")
        page = request.GET.get("page")
        order = request.GET.get("order")
        if order == 'oldest':
            article_order = ""
        else:            
            article_order = "-"

        if media_type == "photos":
            authors_media = UbysseyImage.objects.filter(author=self).order_by(article_order+"updated_at")
        elif media_type == "videos":
            authors_media = VideoSnippet.objects.filter(video_authors__author=self).order_by(article_order+"updated_at")
        elif media_type == "visual-bylines":
            # Get articles where this author is credited with something other than "author" and "org_role"
            authors_media = [] 
            for a in ArticleAuthorsOrderable.objects.filter(author=self).exclude(Q(author_role="author") | Q(author_role="org_role")).order_by(article_order+'article_page__explicit_published_at'):
                # we gotta do this because I can't use .distinct() on a field with mysql. We have to move to postgres for that (sounds like a lot of work) - samlow 21/10/2024
                if not a.article_page in authors_media:
                    authors_media.append(a.article_page)
        else:
            # Get articles where this author is creditted with either "author" or "org_role"
            authors_media = [] 
            for a in ArticleAuthorsOrderable.objects.filter(Q(author=self, author_role="author") | Q(author=self, author_role="org_role")).order_by(article_order+'article_page__explicit_published_at'):
                # same here, can't use .distinct() cause not using postgres - samlow 21/10/2024
                if not a.article_page in authors_media:
                    authors_media.append(a.article_page)
            #authors_media = ArticlePage.objects.live().public().filter(article_authors__author=self).distinct().order_by(article_order)

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
        # For meta tags (see ubyssey.ca/ubyssey/templates/ubyssey/meta_tags.html)
        context["self"].featured_media = self.image
        context["self"].lede = self.bio_description

        media_types = []
        
        if VideoAuthorsOrderable.objects.filter(author=self).exists():
            media_types.append(("videos", "videos"))
        if UbysseyImage.objects.filter(author=self).exists():
            media_types.append(("photos", "photos"))
        if ArticleAuthorsOrderable.objects.filter(author=self, author_role="author").exists():
            media_types.append(("articles", "articles"))
        if ArticleAuthorsOrderable.objects.filter(author=self).exclude(author_role="author").exists():
            media_types.append(("visual-bylines", "visual bylines"))

        context["media_types"] = media_types
        context["media_type"] = self.main_media_type
        context["media_type_name"] = self.main_media_type.replace("-", " ")

        order = request.GET.get("order")
        if order == 'oldest':
            context["order"] = "Oldest"
        else:            
            context['order'] = 'Newest'

        context = self.organize_media(self.main_media_type, request, context)

        return context
    
    def save(self, *args, **kwargs):
        import requests
        from urllib.parse import urlparse
        from django.utils.safestring import mark_safe
        
        domainToIcon = {'www.tumblr.com': 'logo-tumblr',
                        'www.instagram.com': 'logo-instagram',
                        'twitter.com': 'logo-twitter',
                        'www.facebook.com': 'logo-facebook',
                        'www.youtube.com': 'logo-youtube',
                        'www.tiktok.com': 'logo-tiktok',
                        'www.linkedin.com': 'logo-linkedin',
                        'www.reddit.com': 'logo-reddit'}

        for i in range(len(self.linkIcons)):
            del self.linkIcons[-1]

        for link in self.links:
            url = link.value
            domain = urlparse(url).netloc    
            extra = ""
            if domain in domainToIcon:
                icon = domainToIcon[domain]
                if domain == "www.linkedin.com":
                    username = self.full_name
                else:
                    if url[-1] == "/":
                        url = url[0:-1]
                    username = url.split("/")[-1]
                    username = username.replace("@","")
            else:
                icon = "globe"
                try:
                    json = requests.get(urlparse(url).scheme + "://" + domain + "/api/v2/instance").json()
                    if 'source_url' in json:
                        if json['source_url']=='https://github.com/mastodon/mastodon':
                            icon = "logo-mastodon"    
                            extra = "rel='me'"
                            username = url.split("/")[-1]
                            username = username.replace("@","")
                except:
                    icon = "globe"
                    username = domain

            self.linkIcons.append(('raw_html', '<a ' + extra + 'class="social_media_links" href="'+url+'"><ion-icon name="' + icon + '" style="font-size:1em;"></ion-icon>&nbsp;'+username+'</a>'))
            
        if self.last_activity == None:
            self.last_activity = self.first_published_at

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

    @route(r'^articles/$')
    def stories_page(self, request, *args, **kwargs):
        """
        View function for author's stories
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "articles"
        context["media_type_name"] = "articles"

        context = self.organize_media("articles", request, context)

        return render(request, self.template, context)
    
    @route(r'^visual-bylines/$')
    def visuals_page(self, request, *args, **kwargs):
        """
        View function for author's stories
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "visual-bylines"
        context["media_type_name"] = "visual bylines"

        context = self.organize_media("visual-bylines", request, context)

        return render(request, self.template, context)
    
    @route(r'^photos/$')
    def photos_page(self, request, *args, **kwargs):
        """
        View function for author's photos
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "photos"
        context["media_type_name"] = "photos"
        
        context = self.organize_media("photos", request, context)

        return render(request, self.template, context)
    
    @route(r'^videos/$')
    def videos_page(self, request, *args, **kwargs):
        """
        View function for author's videos
        """

        context = self.get_context(request, *args, **kwargs)

        context["media_type"] = "videos"
        context["media_type_name"] = "videos"
        
        context = self.organize_media("videos", request, context)

        return render(request, self.template, context)