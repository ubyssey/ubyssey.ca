from random import randint
import json

from django.http import HttpResponse, Http404
from django.template import loader
from django.shortcuts import render
from django.urls import reverse
from django.contrib.staticfiles.templatetags.staticfiles import static
from django_user_agents.utils import get_user_agent

from dispatch.models import Article, Tag

import ubyssey
from ubyssey.helpers import ArticleHelper

class MagazineTheme(object):
    """Views for The Ubyssey Magazine microsite."""

    SITE_TITLE = 'The Ubyssey Magazine'

    mag_titles = {
        "2017": "Diversity",
        "2018": "How we Live",
        "2019": "Presence"
    }

    def landing(self, request):
        """Magazine landing page view."""

        # Get all 2019 magazine articles
        articles = Article.objects.select_related('section', 'subsection').filter(is_published=True, section__slug='magazine', tags__name='2019').order_by('-importance')
        reclaim = []
        resolve = []
        redefine = []

        for article in articles:
            featuredImage = article.featured_image.image.get_medium_url() if article.featured_image is not None else None
            color = article.template_fields['color'] if 'color' in article.template_fields else None
            temp = {
                    'headline': article.headline,
                    'url': article.get_absolute_url(),
                    'featured_image': featuredImage,
                    'color': color
            }
            if article.subsection.slug == 'reclaim':
                reclaim.append(temp.copy())
            elif article.subsection.slug == 'resolve':
                resolve.append(temp.copy())
            elif article.subsection.slug == 'redefine':
                redefine.append(temp.copy())

        articles = json.dumps({
                'reclaim': reclaim,
                'resolve': resolve,
                'redefine': redefine,
            })

        context = {
            'meta': {
                'title': 'The Ubyssey Magazine - Presence',
                'description': 'The February 2019 issue of the Ubyssey magazine.',
                'url': reverse('magazine-landing'),
                'image': static('images/magazine/2019/cover.gif')
            },
            'cover': 'images/magazine/2019/cover.gif',
            'reclaimImage': 'images/magazine/2019/subsection-reclaim.png',
            'redefineImage': 'images/magazine/2019/subsection-redefine.png',
            'resolveImage': 'images/magazine/2019/subsection-resolve.png',
            'articles': articles,
            'url': reverse('magazine-landing')
        }
        return render(request, 'magazine/2019/landing.html', context)

    def article(self, request, slug=None):
        """Magazine article page view."""

        try:
            article = ArticleHelper.get_article(request, slug)
        except:
            raise Http404('Article could not be found.')

        article.add_view()
        year = article.tags.get(name__icontains="20").name

        magazine_title = self.mag_titles[year]

        subsection = article.subsection.name.lower() if article.subsection else ""

        # determine if user is viewing from mobile
        article_type = 'desktop'
        user_agent = get_user_agent(request)
        if user_agent.is_mobile:
            article_type = 'mobile'

        if not ArticleHelper.is_explicit(article):
            article.content = ArticleHelper.insert_ads(article.content, article_type)

        context = {
            'title': '%s - %s' % (article.headline, self.SITE_TITLE),
            'meta': ArticleHelper.get_meta(article, default_image=static('images/magazine/cover-social.png')),
            'article': article,
            'subsection': subsection,
            'specific_css': 'css/magazine-' + year + '.css',
            'suggested': ArticleHelper.get_random_articles(2, 'magazine', exclude=article.id),
            'base_template': 'magazine/base.html',
            'magazine_title': magazine_title
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

    def landing_2018(self, request):
        """Magazine landing page view."""

        # Get all 2018 magazine articles
        articles = Article.objects.filter(is_published=True, section__slug='magazine', tags__name='2018').order_by('-importance')

        context = {
            'meta': {
                'title': 'The Ubyssey Magazine - How we live',
                'description': 'The February 2018 issue of the Ubyssey magazine.',
                'url': reverse('magazine-landing-2018'),
                'image': static('images/magazine/cover-social.jpg')
            },
            'cover': 'images/magazine/2018/cover.jpg',
            'articles': articles
        }

        return render(request, 'magazine/2018/landing.html', context)
