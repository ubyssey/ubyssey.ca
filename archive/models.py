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

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        # Getting information from the HTTP request
        search_query = request.GET.get("q")
        page = request.GET.get("page")
        order = request.GET.get("order")
        section_slug = request.GET.get('section')
        self.year = self.__parse_int_or_none(request.GET.get('year'))
        if order == 'oldest':
            article_order = "explicit_published_at"
        else:            
            article_order = "-explicit_published_at"
        context["order"] = order

        # Get and trim the queryset of articles
        if section_slug:
            articles = ArticlePage.objects.from_section(section_slug=section_slug).live().public().order_by(article_order)            
        else:
            articles = ArticlePage.objects.live().public().order_by(article_order)
        if self.year:
            articles = articles.filter(explicit_published_at__year=str(self.year))

        # If there's a search query, then we run the search on the articles LAST.
        # Once we hit thes earch then we can't run .filter(...) on the results as if it were a queryset
        if search_query:
            context["search_query"] = search_query
            articles = articles.search(search_query)

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

        # set context
        context['sections'] = SectionPage.objects.live()
        context['section_slug'] = section_slug
        context['order'] = order
        context['year'] = self.year
        context['years'] = self.__get_years()
        context['q'] = search_query
        context['meta'] = { 'title': 'Archive' }

        return context
    
    @route(r'^category/(?P<sections_slug>[-\w]+)/$', name='section_view')
    def get_section_articles(self, request, *args, **kwargs):
        context = self.get_context(request, *args, **kwargs)
        context["test"] = "Hello World 232131312"
        return render(request, "archive/archive_section.html", context)