from django.shortcuts import render
from django.http import Http404

import ubyssey
from ubyssey.helpers import ArticleHelper

class GuideTheme(object):
    """Theme for the 2016 Ubyssey Guide to UBC."""

    def __init__(self, year, title): 
        self.year = str(year)
        self.title = title

    def landing(self, request, year = None):
        """The Guide to UBC landing page."""
        landing_page = 'guide/' + year + '/index.html'
        return render(request, landing_page, {})

    def article(self, request, slug=None):
        """Guide article page."""
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

        article.add_view()

        context = {
            'title': article.headline,
            'meta': ArticleHelper.get_meta(article),
            'article': article,
            'next': [next_a, next_b]
        }
        article_page = 'guide/' + 'article.html'
        return render(request, article_page , context)

guide = GuideTheme(2016, "Guide")
