from django.db import models
from django_user_agents.utils import get_user_agent
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.shortcuts import render

from article.models import ArticlePage
from section.models import SectionPage
from wagtail.core.models import Page
from wagtail.contrib.routable_page.models import RoutablePageMixin, route 
from videos.models import VideosPage, VideoSnippet

class ArchivePage(RoutablePageMixin, Page):
    template = "archive/archive_page.html"

    parent_page_types = [
        'home.HomePage',
    ]
    max_count_per_parent = 1

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

    """
    @route(r'^section/?$') (In the articles page)
        @route(r'^video$') (In the videos page)
        We need to look into how to find magazine articles easily
                pubdate
                title
                description
                cover_image
                social_cover_image

                section_name
                issue
                section_image
                
    @route(r'^year/?$')
    ..... (includes the section and year route)/search=q or /search=".........."
    """
    def get_context(self, request, video_section):
        context = super().get_context(request)
        search_query = request.GET.get("q")
        order = request.GET.get("order")
        self.year = self.__parse_int_or_none(request.GET.get('year'))
        


        # Set context
        context['video_section'] = video_section
        context['sections'] = SectionPage.objects.live()
        context['order'] = order
        context['year'] = self.year
        context['years'] = self.__get_years()
        context['q'] = search_query
        context['meta'] = { 'title': 'Archive' }

        return context
    
    def get_paginated_articles(self, context, articles, request):
        page = request.GET.get("page")
        # Paginate all posts by 15 per page
        paginator = Paginator(articles, per_page=15)
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
        context["articles"] = articles

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

    @route(r'^$', name='general_view')
    def get_archive_general_articles(self, request, *args, **kwargs):
        context = self.get_context(request, False)
        section_slug = context["sections_slug"] = None
        search_query = context["q"]

        articles = ArticlePage.objects.live().public()
 
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, False)     

        if self.year:
            articles = self.get_year_objects(articles, False)
      
      # The larger issue is that the search query in general search will always prioritize articles over videos. If users what to find videos then they have to select the videos section then search
        if search_query:
            videos = VideoSnippet.objects.all()
            articles = self.get_search_objects(search_query, articles, False)
            videos = self.get_search_objects(search_query, videos, True)

            if len(articles) < 1:
                context = self.get_paginated_articles(context, videos, request)
                context["video_section"] = True
            else:
                context = self.get_paginated_articles(context, articles, request)
        else:
            context = self.get_paginated_articles(context, articles, request)

        
        return render(request, "archive/archive_page.html", context)
    
    @route(r'^section/(?P<sections_slug>[-\w]+)/$', name='section_view')
    def get_section_articles(self, request, sections_slug):
        context = self.get_context(request, False)
        section_slug = context['section_slug'] = sections_slug

        search_query = context["q"]
        
        articles = ArticlePage.objects.from_section(section_slug=section_slug).live().public()
 
        if context["order"]:
            articles = self.get_order_objects(context["order"], articles, False)           
        
        if self.year:
            articles = self.get_year_objects(articles, False)
        
        if search_query:
            articles = self.get_search_objects(search_query, articles, False)

        return render(request, "archive/archive_page.html", context)
    
    @route(r'^videos/$', name="videos_view")
    def get_videos(self, request, *args, **kwargs):

        context = self.get_context(request, True)


        search_query = context["q"]
        
        videos = VideoSnippet.objects.all()
 
        if context["order"]:
            videos = self.get_order_objects(context["order"], videos, True)           
        
        if self.year:
            videos = self.get_year_objects(videos, True)
        
        if search_query:
            videos = self.get_search_objects(search_query, videos, True)
        

        context = self.get_paginated_articles(context, videos, request)
        
        return render(request, "archive/archive_page.html", context)