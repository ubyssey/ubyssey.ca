from random import randint

from django.http import HttpResponse, Http404
from django.template import loader
from django.shortcuts import render
from django.core.urlresolvers import reverse
from django.contrib.staticfiles.templatetags.staticfiles import static

from dispatch.models import Article

from ubyssey.helpers import ArticleHelper

class MagazineTheme(object):
    """Views for The Ubyssey Magazine microsite."""

    SITE_TITLE = 'The Ubyssey Magazine'

    def landing(self, request):
        """Magazine landing page view."""

        # Get all 2018 magazine articles
        articles = Article.objects.filter(is_published=True, section__slug='magazine', tags__name='2018').order_by('-importance')

        context = {
            'meta': {
                'title': 'The Ubyssey Magazine - How we live',
                'description': 'The February 2018 issue of the Ubyssey magazine.',
                'url': reverse('magazine-landing'),
                'image': static('images/magazine/cover-social.jpg')
            },
            'cover': 'images/magazine/cover.jpg',
            'articles': articles
        }

        return render(request, 'magazine/landing.html', context)

    def article(self, request, slug=None):
        """Magazine article page view."""

        try:
            article = ArticleHelper.get_article(request, slug)
        except:
            raise Http404('Article could not be found.')

        article.add_view()

        context = {
            'title': '%s - %s' % (article.headline, self.SITE_TITLE),
            'meta': ArticleHelper.get_meta(article, default_image=static('images/magazine/cover-social.png')),
            'article': article,
            'suggested': ArticleHelper.get_random_articles(2, 'magazine', exclude=article.id),
            'base_template': 'magazine/base.html'
        }

        t = loader.select_template(['%s/%s' % (article.section.slug, article.get_template_path()), article.get_template_path()])

        return HttpResponse(t.render(context))

    def landing_2017(self, request, year=None):
        """Archive landing page."""

        # Get all 2017 magazine articles
        articles = Article.objects.filter(is_published=True, section__slug='magazine', tags__name='2017').order_by('-importance')

        context = {
            'meta': {
                'title': 'The Ubyssey Magazine - 2017',
                'description': 'The Ubyssey\'s first magazine.',
                'url': reverse('magazine-landing-2017'),
                'image': static('images/magazine/2017/cover-social.png')
            },
            'cover': 'images/magazine/2017/cover-%d.jpg' % randint(1, 2),
            'articles': articles
        }

        return render(request, 'magazine/2017/landing.html', context)
