from random import randint
import json

from django.http import HttpResponse, Http404
from django.template import loader
from django.shortcuts import render
from django.urls import reverse
from django.templatetags.static import static
from django_user_agents.utils import get_user_agent
from django.db.models import F

from dispatch.models import Article, Tag

import ubyssey
from ubyssey.helpers import ArticleHelper

class MagazineTheme(object):

    def __init__(self): 
        self.mags = {}
    
    def add_magazine(self, magazine):
        self.mags[magazine.year]=magazine

    def landing(self, request):
        # homepage for all magazines
        pass

    def magazine(self, request, year=None):
        """Landing page for a specific magazine year."""
        if year in self.mags:
            return self.mags[year].landing(request)

        raise Http404("Page cannot be found") 

    def article(self, request, slug=None):
        #TODO: tidy these remaining views up
        try:
            article = ArticleHelper.get_article(request, slug)
        except:
            raise Http404('Article could not be found.')

        Article.objects.filter(slug=slug, is_published=True).update(views=F('views')+1) #Not great, but this whole view is bad and is mostly sloppy legacy code

        year = article.tags.get(name__icontains="20").name

        if year in self.mags:
            return self.mags[year].article(request, article)

        raise Http404("Magazine for the year %d does not exist." % year) 

class Magazine(object):

    SITE_TITLE = 'The Ubyssey Magazine'

    def __init__(self, year, title): 
        self.year = str(year)
        self.title = title
    
    def article(self, request, article):
        """Magazine article page view."""

        subsection = article.subsection.name.lower() if article.subsection else ""

        # determine if user is viewing from mobile
        article_type = 'desktop'
        user_agent = get_user_agent(request)
        if user_agent.is_mobile:
            article_type = 'mobile'

        if not ArticleHelper.is_explicit(article):
            article.content = ArticleHelper.insert_ads(article.content, article_type)

        #TODO: Fix hardcoding on default_image; no good available default
        context = {
            'title': '%s - %s' % (article.headline, self.SITE_TITLE),
            'meta': ArticleHelper.get_meta(article, default_image=static('ubyssey/images/magazine/2017/cover-social.png')),
            'article': article,
            'subsection': subsection,
            'specific_css': 'ubyssey/css/magazine-' + self.year + '.css',
            'year': self.year,
            'suggested': ArticleHelper.get_random_articles(2, 'magazine', exclude=article.id),
            'base_template': 'magazine/base.html',
            'magazine_title': self.title,
        }

        t = loader.select_template(['%s/%s' % (article.section.slug, article.get_template_path()), article.get_template_path()])

        return HttpResponse(t.render(context))


class MagazineV1(Magazine):
    """View type 1 for The Ubyssey Magazine 2017 2018 microsite."""

    def __init__(self, year, title, description, get_cover, social_cover, template):
        super().__init__(year, title)
 
        self.description = description
        self.get_cover = get_cover
        self.social_cover = social_cover
        self.template = template

    def landing(self, request, year=None):
        """Archive landing page."""

        articles = Article.objects.filter(is_published=True, section__slug='magazine', tags__name=self.year).order_by('-importance')

        context = {
            'meta': {
                'title': self.title,
                'description': self.description,
                'url': reverse('magazine-landing', kwargs={'year': self.year}),
                'image': static(self.social_cover)
            },
            'cover': self.get_cover,
            'articles': articles,
            'year': self.year
        }

        return render(request, self.template, context)

class MagazineV2(Magazine):
    """View type 2 for The Ubyssey Magazine 2019 2020 microsite."""
    def __init__(self, year, title, description, get_cover, template, section1_img, section2_img, section3_img, section1_name, section2_name, section3_name):
        super().__init__(year, title)
 
        self.description = description
        self.get_cover = get_cover
        self.template = template
        self.section1_name = section1_name
        self.section2_name = section2_name
        self.section3_name = section3_name
        self.section1_img = section1_img
        self.section2_img = section2_img
        self.section3_img = section3_img

    def landing(self, request, year=None):
        """Magazine landing page view."""

        # Get all 2019 magazine articles
        articles = Article.objects.select_related('section', 'subsection').filter(is_published=True, section__slug='magazine', tags__name=self.year).order_by('-importance')
        section1 = [] 
        section2 = [] 
        section3 = []

        for article in articles:
            featuredImage = article.featured_image.image.get_medium_url() if article.featured_image is not None else None
            color = article.template_fields['color'] if 'color' in article.template_fields else None
            
            temp = {
                'headline': article.headline,
                'url': article.get_absolute_url(),
                'featured_image': featuredImage,
                'color': color
            }

            if article.subsection:
                if article.subsection.slug == self.section1_name:
                    section1.append(temp.copy())
                elif article.subsection.slug == self.section2_name:
                    section2.append(temp.copy())
                elif article.subsection.slug == self.section3_name:
                    section3.append(temp.copy())

        articles = json.dumps({
                self.section1_name: section1,
                self.section2_name: section2,
                self.section3_name: section3,
            })

        context = {
            'meta': {
                'title': self.title,
                'description': self.description,
                'url': reverse('magazine-landing', kwargs={'year': self.year}),
                'image': static(self.get_cover)
            },
            'cover': self.get_cover,
            'year': self.year,
            'section1Image': self.section1_img,
            'section2Image': self.section2_img,
            'section3Image': self.section3_img,
            'articles': articles
        }
        return render(request, self.template, context)

magazine = MagazineTheme()

mag2017 = MagazineV1(
    2017,
    'The Ubyssey Magazine',
    'The Ubyssey\'s first magazine.',
    lambda: 'ubyssey/images/magazine/2017/cover-%d.jpg' % randint(1, 2),
    'ubyssey/images/magazine/2017/cover-social.png',
    'magazine/2017/landing.html',
)

mag2018 = MagazineV1(
    2018,
    'The Ubyssey Magazine - How we live',
    'The February 2018 issue of the Ubyssey magazine.',
    'ubyssey/images/magazine/2018/cover.jpg',
    'ubyssey/images/magazine/2018/cover-social.jpg',
    'magazine/2018/landing.html',
)

mag2019 = MagazineV2(
    2019,
    'The Ubyssey Magazine - Presence',
    'The February 2019 issue of the Ubyssey magazine.',
    'ubyssey/images/magazine/2019/cover.gif',
    'magazine/2019/landing.html',
    'ubyssey/images/magazine/2019/subsection-reclaim.png',
    'ubyssey/images/magazine/2019/subsection-redefine.png',
    'ubyssey/images/magazine/2019/subsection-resolve.png',
    'reclaim',
    'redefine',
    'resolve',
)

mag2020 = MagazineV2(
    2020,
    'The Ubyssey Magazine - Hot Mess',
    'The February 2020 issue of the Ubyssey magazine.',
    'ubyssey/images/magazine/2020/cover.png',
    'magazine/2020/landing.html',
    'ubyssey/images/magazine/2020/section1.png',
    'ubyssey/images/magazine/2020/section2.png',
    'ubyssey/images/magazine/2020/section3.jpg',
    'goesAround',
    'comesAround',
    'waysForward',
)

magazine.add_magazine(mag2017)
magazine.add_magazine(mag2018)
magazine.add_magazine(mag2019)
magazine.add_magazine(mag2020)