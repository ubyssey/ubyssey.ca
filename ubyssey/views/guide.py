from django.shortcuts import render
from django.http import Http404
import json
from django.utils.safestring import SafeString
from dispatch.models import Article, Tag
from django.urls import reverse
import ubyssey
from ubyssey.helpers import ArticleHelper

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
        article_page = 'guide/2016/article.html'
        return render(request, article_page , context)


class Guide2020(object):
    """Theme for the 2016 Ubyssey Guide to UBC."""

    def __init__(self, year, title, section1_name, section2_name, section3_name, section4_name, section5_name): 
        self.year = str(year)
        self.title = title
        self.section1_name = section1_name
        self.section2_name = section2_name
        self.section3_name = section3_name
        self.section4_name = section4_name
        self.section5_name = section5_name

    def landing(self, request, year):
        landing_page = 'guide/' + year + '/index.html'
        return render(request, landing_page, {})
    
    def landing_sub(self, request, year, subsection=None):

        articles = Article.objects.select_related('section', 'subsection').filter(is_published=True, section__slug='guide', tags__name=self.year).order_by('-importance')
        section1 = [] 
        section2 = [] 
        section3 = []
        section4 = []
        section5 = []

        for article in articles:
            featuredImage = article.featured_image.image.get_medium_url() if article.featured_image is not None else None
            url_absolute = article.get_absolute_url()
            string_to_find = 'guide/'
            index = url_absolute.find(string_to_find) + len(string_to_find)
            slug = url_absolute[index: len(url_absolute)-1]
            temp = {
                'headline': article.headline,
                'slug': slug,
                'featured_image': featuredImage,
            }

            if article.subsection:
                if article.subsection.slug == self.section1_name:
                    section1.append(temp.copy())
                elif article.subsection.slug == self.section2_name:
                    section2.append(temp.copy())
                elif article.subsection.slug == self.section3_name:
                    section3.append(temp.copy())
                elif article.subsection.slug == self.section4_name:
                    section4.append(temp.copy())
                elif article.subsection.slug == self.section5_name:
                    section5.append(temp.copy())
                

        articles = json.dumps({
                self.section1_name: section1,
                self.section2_name: section2,
                self.section3_name: section3,
                self.section4_name: section4,
                self.section5_name: section5,
            })

        articles_parse = json.loads(articles)
        academics = articles_parse["academics"]
        ubc = articles_parse["ubc"]
        adulting = articles_parse["adulting"]
        sdp = articles_parse["sex, drugs, party"]
        vancouver = articles_parse["vancouver"]
        
        context = {
            'subsection': subsection,
            'articles': {
                'academics': academics,
                'ubc': ubc,
                'adulting': adulting,
                'sdp': sdp,
                'vancouver': vancouver
            }

        }
        """The Guide to UBC landing page."""
        landing_page = 'guide/' + year + '/section.html'
        return render(request, landing_page, context)

    def article(self, request, year=None, subsection=None, slug=None):
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
            'subsection': subsection,
            'article': article,
            'next': [next_a, next_b]
        }
        article_page = 'guide/' + year + '/article.html'
        return render(request, article_page , context)



guide2016 = Guide2016("Guide")
guide2020 = Guide2020(2020, "Guide", "academics", "ubc", "adulting", "sex, drugs, party", "vancouver")
