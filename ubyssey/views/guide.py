from django.shortcuts import render
from django.http import Http404
import json
from django.utils.safestring import SafeString
from dispatch.models import Article, Tag
from django.urls import reverse
import ubyssey
from ubyssey.helpers import ArticleHelper
from ubyssey.mixins import DispatchPublishableViewMixin, GuideViewMixin
from django.views.generic.detail import DetailView
from django.views.generic.base import TemplateView
from django.db.models import F


class Guide2016(object):
    """Theme for the 2016 Ubyssey Guide to UBC."""

    def __init__(self, title): 
        self.title = title

    def landing(self, request):
        """The Guide to UBC landing page."""
        landing_page = 'guide/2016/index.html'
        return render(request, landing_page, {})

    def article(self, request, slug=None):
        """Guide article page."""
        #TODO: tidy these remaining views up
        try:
            article = ArticleHelper.get_article(request, slug)
        except:
            raise Http404('Article could not be found.')

        template_fields = article.template_fields

        try:
            next_a = ArticleHelper.get_article(request, template_fields['next_a'])
        except:
            next_a = None

        try:
            next_b = ArticleHelper.get_article(request, template_fields['next_b'])
        except:
            next_b = None

        Article.objects.filter(slug=slug, is_published=True).update(views=F('views')+1) #Not great, but this whole view is bad and is mostly sloppy legacy code

        context = {
            'title': article.headline,
            'meta': ArticleHelper.get_meta(article),
            'article': article,
            'next': [next_a, next_b]
        }
        article_page = 'guide/2016/article.html'
        return render(request, article_page , context)

class GuideArticleView(DispatchPublishableViewMixin, GuideViewMixin, DetailView):
    """
    Attributes:
        subsection: Slug of Subsection model from Dispatch. Input in URL.
        year:       Should be input in the URL.
                    Tries to default to 2020 if it somehow can't be initialized during setup
    """
    model = Article

    def setup(self, request, *args, **kwargs):
        self.subsection = kwargs['subsection']
        self.year = kwargs['year'] if kwargs['year'] is not None else 2020
        return super().setup(request, *args, **kwargs)
    
    def get_template_names(self):
        template_name = 'guide/' + self.year + '/article.html'
        return [template_name]

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['meta']: self.get_article_meta(self.object)
        return context

class GuideLandingView(GuideViewMixin, TemplateView):
    """
    Attributes:
        year:       Should be input in the URL.
                    Tries to default to 2020 if it somehow can't be initialized during setup
    """
    def setup(self, request, *args, **kwargs):
        try:
            self.year = kwargs['year']
        except KeyError:
            self.year = 2000
        
        if 'subsection' in kwargs:
            self.template_name = 'guide/' + self.year + '/section.html'
        else:
            self.template_name = 'guide/' + self.year + '/index.html'

        return super().setup(request, *args, **kwargs)

guide2016 = Guide2016("Guide")
