from django.db import models
from django_user_agents.utils import get_user_agent
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.shortcuts import render

from specialfeaturelanding.models import SpecialLandingPage
from section.models import SectionablePage, CategorySnippet
from article.models import ArticlePage
from modelcluster.fields import ParentalKey

from section.models import SectionPage
from wagtail.core.models import Page, Orderable
from wagtail.snippets.edit_handlers import SnippetChooserPanel
from wagtail.admin.edit_handlers import MultiFieldPanel, InlinePanel, HelpPanel, PageChooserPanel

from wagtail.contrib.routable_page.models import RoutablePageMixin, route 
from videos.models import VideosPage, VideoSnippet

class SectionPageOrderables(Orderable):
    page = ParentalKey("archive.ArchivePage", on_delete=models.CASCADE, related_name="sections_filters")
    
    section_filter = models.ForeignKey(
        'wagtailcore.Page',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name="Section Page"
    )
    
    panels = [
        MultiFieldPanel(
          [
            PageChooserPanel('section_filter', 'section.SectionPage'),
          ],
        heading="Section Pages",
        ),
    ]


class MagazineOrderables(Orderable):
    page = ParentalKey("archive.ArchivePage", on_delete=models.CASCADE, related_name="magazines_filters")
    
    magazine_filter = models.ForeignKey(
        'section.CategorySnippet',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name="Magazine"
    )
    
    panels = [
        MultiFieldPanel(
          [
            SnippetChooserPanel('magazine_filter'),
          ],
        heading="Magazine",
        ),
    ]

class SpoofOrderables(Orderable):
    page = ParentalKey("archive.ArchivePage", on_delete=models.CASCADE, related_name="spoofs_filters")
    
    spoof_filter = models.ForeignKey(
        'section.CategorySnippet',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name="Spoof"
    )
    
    panels = [
        MultiFieldPanel(
          [
            SnippetChooserPanel('spoof_filter'),
          ],
        heading="Spoof",
        ),
    ]


class ArchivePage(RoutablePageMixin, Page):
    template = "archive/archive_page.html"

    parent_page_types = [
        'home.HomePage',
    ]
    max_count_per_parent = 1
    
    
    content_panels = Page.content_panels + [
        MultiFieldPanel(
          [
            HelpPanel("List all the pages you want to have in the section filter"),
            InlinePanel('sections_filters', min_num=1, label="Section"),
          ],
        heading="Section Filters",
        classname="collapsible",
        ),
        MultiFieldPanel(
          [
            HelpPanel("List all the category snippets you want to have in the magazine filter"),
            InlinePanel('magazines_filters', min_num=1, label="Magazines"),
          ],
        heading="Magazine Filters",
        classname="collapsible",
        ),
        MultiFieldPanel(
          [
            HelpPanel("List all the category snippets you want to have in the spoof filter"),
            InlinePanel('spoofs_filters', min_num=1, label="Spoofs"),
          ],
        heading="Spoof Filters",
        classname="collapsible",
        ),
    ]
    
    def __get_years(self):
        """
        Returns:
            Hits DB to find list of years such that there is an article published at that year
        """
        publish_dates = ArticlePage.objects.live().dates('explicit_published_at','year',order='DESC')
        years = []

        for publish_date in publish_dates:
            years.append(publish_date.year)

        return years

    def __parse_int_or_none(self, maybe_int):
        """
        Private helper that enforces stricter discipline on section id and year values in request headers.
        
        Returns:
            maybe_int cast to an integer or None if the cast fails. 
        """
        try:
            return int(maybe_int)
        except (TypeError, ValueError):
            return None


    def get_context(self, request, video_section):
        # Get queries and context
        context = super().get_context(request)
        search_query = request.GET.get("q")
        order = request.GET.get("order")
        self.year = self.__parse_int_or_none(request.GET.get('year'))
        
        # Set context
        context['video_section'] = video_section
        context['sections'] = self.sections_filters.all()
        context['order'] = order
        context['year'] = self.year
        context['years'] = self.__get_years()
        context['q'] = search_query
        context['meta'] = { 'title': 'Archive' }

        return context
    
    def get_paginated_articles(self, context, objects, video_section, request):
        page = request.GET.get("page")

        if video_section == False:
            # Paginate all posts by 15 per page
            paginator = Paginator(objects, per_page=15)
        else:
            # Paginate all posts by 15 per page
            paginator = Paginator(objects, per_page=5)
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

        context["page_obj"] = paginated_articles #this object is often called page_obj in Django docs. Careful, because but Page means something else in Wagtail
        

        return context

    def get_order_objects(self, order, objects, videos_section):
        if videos_section == False:
            if order == 'oldest':
                article_order = "explicit_published_at"
            else:            
                article_order = "-explicit_published_at"
            
            return objects.order_by(article_order)
        else:
            if order == 'oldest':
                videos_order = "created_at"
            else:
                videos_order = "-created_at"
            
            return objects.order_by(videos_order)
        

    def get_year_objects(self, objects, videos_section):
        if videos_section == False:
            return objects.filter(explicit_published_at__year=str(self.year))
        else:
            return objects.filter(created_at__gte=str(self.year) + "-01-01", created_at__lte = str(self.year + 1) + "-12-31")
        
    def get_search_objects(self, search_query, objects, video_section):
        
        # If there's a search query, then we run the search on the articles LAST.
        # Once we hit thes earch then we can't run .filter(...) on the results as if it were a queryset
        if video_section == False:
            return objects.search(search_query)
        else:
            return objects.filter(title=search_query)

    def get_category(self):
        return CategorySnippet.objects.all()
    categories = property(fget=get_category)

    @route(r'^$', name='general_view')
    def get_archive_general_articles(self, request):
        video_section = False
        context = self.get_context(request, video_section)
        context["section_slug"] = "All"
        search_query = context["q"]

        articles = ArticlePage.objects.live().public()
 
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, video_section)     

        if self.year:
            articles = self.get_year_objects(articles, video_section)
      
      # The larger issue is that the search query in general search will always prioritize articles over videos. If users what to find videos then they have to select the videos section then search
        if search_query:
            videos = VideoSnippet.objects.all()
            articles = self.get_search_objects(search_query, articles, video_section)
            videos = self.get_search_objects(search_query, videos, True)

            if len(articles) < 1:
                context = self.get_paginated_articles(context, videos, request)
                context["video_section"] = True
            else:
                context = self.get_paginated_articles(context, articles, request)
        else:
            context = self.get_paginated_articles(context, articles, video_section, request)

        
        return render(request, "archive/archive_page.html", context)
    
    @route(r'^section/(?P<sections_slug>[-\w]+)/$', name='section_view')
    @route(r'^magazines/$', name='magazines_general_view')
    def get_section_articles(self, request, sections_slug="magazine"):
        video_section = False
        context = self.get_context(request, video_section)
        context['section_slug'] = sections_slug

        search_query = context["q"]
        
        articles = ArticlePage.objects.from_section(section_slug=sections_slug).live().public()
        
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, video_section)           
        
        if self.year:
            articles = self.get_year_objects(articles, video_section)
        
        if search_query:
            articles = self.get_search_objects(search_query, articles, video_section)

        context = self.get_paginated_articles(context, articles, video_section, request)

        return render(request, "archive/archive_page.html", context)
    
    @route(r'^videos/$', name="videos_view")
    def get_videos(self, request, *args, **kwargs):
        video_section = True
        context = self.get_context(request, video_section)

        search_query = context["q"]
        
        videos = VideoSnippet.objects.all()
 
        if context["order"]:
            videos = self.get_order_objects(context["order"], videos, video_section)           
        
        if self.year:
            videos = self.get_year_objects(videos, video_section)
        
        if search_query:
            videos = self.get_search_objects(search_query, videos, video_section)
        

        context = self.get_paginated_articles(context, videos, video_section, request)
        
        return render(request, "archive/archive_page.html", context)
    

    @route(r'^magazines/(?P<magazine_slug>[-\w]+)/$', name="magazines_view")
    def get_magazine_articles(self, request, magazine_slug):
        video_section = False
        context = self.get_context(request, video_section)
        context['magazine_slug'] = magazine_slug

        search_query = context["q"]
        
        
        if len(SpecialLandingPage.objects.filter(category__slug=magazine_slug)) > 0:
            articles = ArticlePage.objects.from_magazine_special_section(section_slug=magazine_slug)
        else:
            articles = ArticlePage.objects.live().public().filter(category__slug=magazine_slug)
        
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, video_section)           
        
        if self.year:
            articles = self.get_year_objects(articles, video_section)
        
        if search_query:
            articles = self.get_search_objects(search_query, articles, video_section)

        context = self.get_paginated_articles(context, articles, video_section, request)
        
        return render(request, "archive/archive_page.html", context)
    
    @route(r'^spoofs/(?P<spoof_slug>[-\w]+)/$', name="spoofs_view")
    @route(r'^spoofs/$', name="spoofs_general_view")
    def get_spoof_articles(self, request, spoof_slug="All Spoofs"):
        video_section = False
        context = self.get_context(request, video_section)
        context['spoof_slug'] = spoof_slug

        search_query = context["q"]
        
        if spoof_slug == "All Spoofs":
            articles = ArticlePage.objects.none()

            for iter in self.spoofs_filters.all():
                sections = SectionPage.objects.filter(categories__slug=iter.spoof_filter.slug).live().public()
                articles = articles | ArticlePage.objects.from_section(section_slug=sections[0].slug).live().public()
        else:
            sections = SectionPage.objects.filter(categories__slug=spoof_slug).live().public()
            articles = ArticlePage.objects.from_section(section_slug=sections[0].slug).live().public()
        
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, video_section)           
        
        if self.year:
            articles = self.get_year_objects(articles, video_section)
        
        if search_query:
            articles = self.get_search_objects(search_query, articles, video_section)
        

        context = self.get_paginated_articles(context, articles, video_section, request)
        
        return render(request, "archive/archive_page.html", context)