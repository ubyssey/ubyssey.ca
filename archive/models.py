from django.db import models
from django_user_agents.utils import get_user_agent
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.shortcuts import render

from article.models import ArticlePage
from section.models import SectionPage
from wagtail.core.models import Page
from wagtail.contrib.routable_page.models import RoutablePageMixin, route 

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
    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        search_query = request.GET.get("q")
        order = request.GET.get("order")
        self.year = self.__parse_int_or_none(request.GET.get('year'))
        
    

        # Set context
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

    def get_order_articles(self, order, articles):
        if order == 'oldest':
            article_order = "explicit_published_at"
        else:            
            article_order = "-explicit_published_at"
        
        return articles.order_by(article_order)

    def get_year_articles(self, articles):
        
        return articles.filter(explicit_published_at__year=str(self.year))
    
    def get_search_articles(self, search_query, articles):
        
        # If there's a search query, then we run the search on the articles LAST.
        # Once we hit thes earch then we can't run .filter(...) on the results as if it were a queryset
                
        return articles.search(search_query)

    @route(r'^$', name='general_view')
    def get_archive_general_articles(self, request, *args, **kwargs):
        context = self.get_context(request, *args, **kwargs)
        section_slug = context["sections_slug"] = None
        search_query = context["q"]

        articles = ArticlePage.objects.live().public()
 
        if context["order"]:
            articles = self.get_order_articles(context["order"], articles)     

        if self.year:
            articles = self.get_year_articles(articles)

        if search_query:
            articles = self.get_search_articles(search_query, articles)

        context = self.get_paginated_articles(context, articles, request)
        
        return render(request, "archive/archive_page.html", context)
    
    @route(r'^section/(?P<sections_slug>[-\w]+)/$', name='section_view')
    def get_section_articles(self, request, *args, **kwargs):
        context = self.get_context(request, *args, **kwargs)
        section_slug = context['section_slug'] = kwargs["sections_slug"]

        search_query = context["q"]
        
        articles = ArticlePage.objects.from_section(section_slug=section_slug).live().public()
 
        if context["order"]:
            articles = self.get_order_articles(context["order"], articles)           
        
        if self.year:
            articles = self.get_year_articles(articles)
        
        if search_query:
            articles = self.get_search_articles(search_query, articles)
        

        context = self.get_paginated_articles(context, articles, request)
        
        return render(request, "archive/archive_page.html", context)
    