# Helper classes are generally considered code smell. These are left in the code insofar as some functionality still depends upon them.
# Their use should be minimized. These were typically used with Views, but the standard pattern for code reuse for views in 
# Django is instead to create mixins for class Views

import datetime
from datetime import datetime

from django.utils import timezone
import pytz
from random import randint, choice

from django.conf import settings
from django.http import Http404
from django.db import connection
from django.db.models import Case, ExpressionWrapper, DurationField, F, FloatField, OuterRef, Subquery, Value, When 
from django.db.models.aggregates import Count

from dispatch.models import Article, Page, Section, Subsection, Podcast, Image, ImageAttachment

from ubyssey.events.models import Event

class ArticleHelper(object):
    """
    Deprecated legacy code, left intact only insofar as necessary for compatibility.

    Use ArticleMixin instead if necessary
    """
    @staticmethod
    def get_article(request, slug):
        """If the url requested includes the querystring parameters 'version' and 'preview_id',
        get the article with the specified version and preview_id.

        Otherwise, get the published version of the article.
        """
        return Article.objects.get(request=request, slug=slug, is_published=True)

    @staticmethod
    def insert_ads(content, article_type='desktop'):
        """Inject upto 5 ads evenly throughout the article content.
        Ads cannot inject directly beneath headers."""
        ad = {
            'type': 'ad',
            'data': article_type
        }

        paragraph_count = 1

        for block in content:
            paragraph_count = len([b for b in content if b['type'] == 'paragraph'])

        number_of_ads = 1
        paragraphs_per_ad = 6

        while paragraph_count / number_of_ads > paragraphs_per_ad :
            number_of_ads += 1
            if number_of_ads >= 5:
                paragraphs_per_ad = paragraph_count // number_of_ads
                break

        ad_count = 0
        paragraph_count = 0
        next_ad = randint(paragraphs_per_ad - 2, paragraphs_per_ad + 2)
        ad_placements = content

        for index, block in enumerate(content):
            if block['type'] == 'paragraph':
                paragraph_count += 1
            if paragraph_count == next_ad:
                    if index != 0 and content[index - 1]['type'] != 'header':
                        ad_placements.insert(index + ad_count, ad)
                        next_ad += randint(paragraphs_per_ad - 2, paragraphs_per_ad + 2)
                        ad_count += 1
                    else:
                        next_ad += 1

        return ad_placements

    @staticmethod
    def get_frontpage(sections=[], exclude=[], limit=7, is_published=True, max_days=14):

        reading_times = {
            'morning_start': '9:00:00',
            'midday_start': '11:00:00',
            'midday_end': '16:00:00',
            'evening_start': '16:00:00',
        }
        timeformat = '%H:%M:%S'
        articles = Article.objects.annotate(
            age = ExpressionWrapper(
                F('published_at') - timezone.now(),
                output_field=DurationField()
            ),
            reading = Case( 
                When(reading_time='morning', then=1.0 if timezone.now().time() < datetime.strptime(reading_times['morning_start'],timeformat).time() else 0.0),
                When(reading_time='midday', 
                    then=1.0 if (
                        timezone.now().time() >= datetime.strptime(reading_times['midday_start'],timeformat).time() and timezone.now().time() < datetime.strptime(reading_times['midday_start'],timeformat).time()
                    )  else 0.0),
                When(reading_time='evening', then=1.0 if timezone.now().time() <= datetime.strptime(reading_times['evening_start'],timeformat).time() else 0.0),
                default = Value(0.5),
                output_field=FloatField()
            ),
        ).filter(
            head=1,
            is_published=is_published,
            section__slug__in=sections # See this link for why you can do this instead of SQL joining: https://docs.djangoproject.com/en/3.0/topics/db/queries/#lookups-that-span-relationships
        ).exclude(
            parent_id__in=exclude
        ).order_by(
            '-published_at'
        )[:limit]
        
        return list(articles)

    @staticmethod
    def is_explicit(article):
        explicit_tags = ['sex', 'explicit']
        tags = article.tags.all().values_list('name', flat=True)
        for tag in tags:
            if tag.lower() in explicit_tags:
                return True
        return False

    @staticmethod
    def get_random_articles(n, section, exclude=None):
        """Returns `n` random articles from the given section."""

        # Get all articles in section
        queryset = Article.objects.filter(is_published=True, section__slug=section)

        # Exclude article (optional)
        if exclude:
            queryset = queryset.exclude(id=exclude)

        # Get article count
        count = queryset.aggregate(count=Count('id'))['count']

        # Get all articles
        articles = queryset.all()

        # Force a query (to optimize later calls to articles[index])
        list(articles)

        results = []
        indices = set()

        # n is bounded by number of articles in database
        n = min(count, n)

        while len(indices) < n:
            index = randint(0, count - 1)

            # Prevent duplicate articles
            if index not in indices:
                indices.add(index)
                results.append(articles[index])

        return results
        
    @staticmethod
    def get_meta(article, default_image=None):
        try:
            image = article.featured_image.image.get_medium_url()
        except:
            image = default_image

        return {
            'title': article.headline,
            'description': article.seo_description if article.seo_description is not None else article.snippet,
            'url': article.get_absolute_url,
            'image': image,
            'author': article.get_author_type_string()
        }

class PodcastHelper(object):
    @staticmethod
    def get_podcast_episode_url(podcast_id, id):
        """ Return the podcast episode url"""
        podcast = Podcast.objects.get(id=podcast_id)
        return "%spodcast/%s#%s" % (settings.BASE_URL, podcast.slug, id)

    @staticmethod
    def get_podcast_url(id=None):
        """ Return the podcast url"""
        return "%spodcast/episodes" % (settings.BASE_URL)

class VideoHelper(object):
    @staticmethod
    def get_video_url(video_id):
        """ Return the video url"""
        return "%svideos/#video-%s" % (settings.BASE_URL, video_id)

    @staticmethod
    def get_video_page_url():
        """ Return the video page url"""
        return "%svideos/" % (settings.BASE_URL)

    @staticmethod
    def get_media_author_url(person_slug):
        """ Return the archive url for the video author"""
        return "%sauthors/%s/" % (settings.BASE_URL, person_slug)


class NationalsHelper(object):
    @staticmethod
    def prepare_data(content):
        """ Add team/player blurb to dataObj"""
        import json
        import math
        result = {
            "content": [],
            "code": {}
        }

        for chunk in content:
            if chunk['type'] == 'code':
                result['code'] = json.loads(chunk['data']['content'])

            elif chunk['type'] == 'gallery':
                gallery = ImageAttachment.objects.all().filter(gallery__id=int(chunk['data']['id']))

                for index, image in enumerate(gallery):
                    if index % 2 == 0:
                        result['code'][int(math.floor(index/2))]['image'] = {
                            'thumbnail': image.image.get_thumbnail_url(),
                            'medium': image.image.get_medium_url(),
                        }
                    else:
                        result['code'][int(math.floor(index/2))]['player']['image'] = {
                            'thumbnail': image.image.get_thumbnail_url(),
                            'medium': image.image.get_medium_url(),
                        }
            else:
                result['content'].append(chunk)

        return result

class FoodInsecurityHelper(object):
    @staticmethod
    def prepare_data(content):
        """ separate code data from content"""
        import json
        result = {
            "content": [],
            "code": None
        }

        for chunk in content:
            if chunk['type'] == 'code':
                result['code'] = json.loads(chunk['data']['content'])
            else:
                result['content'].append(chunk)

        return result
