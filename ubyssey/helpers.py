import datetime
from random import randint

from django.http import Http404
from django.db import connection
from django.db.models.aggregates import Count

from dispatch.models import Article, Page, Section

from ubyssey.events.models import Event

class ArticleHelper(object):
    @staticmethod
    def get_article(request, slug):
        """If the url requested includes the querystring parameters 'version' and 'preview_id',
        get the article with the specified version and preview_id.

        Otherwise, get the published version of the article.
        """
        return Article.objects.get(request=request, slug=slug, is_published=True)

    @staticmethod
    def get_reading_time(article):
        word_count = 0
        words_per_min = 150
        for block in article.content:
            if block['type'] == 'paragraph':
                word_count += len(block['data'].split(' '))

        reading_time = word_count / words_per_min
        return reading_time

    @staticmethod
    def get_frontpage(reading_times=None, section=None, section_id=None, sections=[], exclude=[], limit=7, is_published=True, max_days=14):

        if is_published:
            is_published = 1
        else:
            is_published = 0

        if reading_times is None:
            reading_times = {
                'morning_start': '9:00:00',
                'midday_start': '11:00:00',
                'midday_end': '16:00:00',
                'evening_start': '16:00:00',
            }

        context = {
            'section': section,
            'section_id': section_id,
            'excluded': ",".join(map(str, exclude)),
            'sections': ",".join(sections),
            'limit': limit,
            'is_published': is_published,
            'max_days': max_days
        }

        context.update(reading_times)

        query = """
            SELECT *, TIMESTAMPDIFF(SECOND, published_at, NOW()) as age,
            CASE reading_time
                 WHEN 'morning' THEN IF( CURTIME() < %(morning_start)s, 1, 0 )
                 WHEN 'midday'  THEN IF( CURTIME() >= %(midday_start)s AND CURTIME() < %(midday_end)s, 1, 0 )
                 WHEN 'evening' THEN IF( CURTIME() >= %(evening_start)s, 1, 0 )
                 ELSE 0.5
            END as reading,
            TIMESTAMPDIFF(DAY, published_at, NOW()) <= %(max_days)s as age_deadline
            FROM dispatch_article
        """

        query_where = """
            WHERE head = 1 AND
            is_published = %(is_published)s AND
            parent_id NOT IN (%(excluded)s)
        """

        if section is not None:
            query += """
                INNER JOIN dispatch_section on dispatch_article.section_id = dispatch_section.id AND dispatch_section.slug = %(section)s
            """
        elif section_id is not None:
            query_where += " AND section_id = %(section_id)s "
        elif sections:
            query_where += "AND section_id in (SELECT id FROM dispatch_section WHERE FIND_IN_SET(slug,%(sections)s))"

        query += query_where + """
            ORDER BY age_deadline DESC, reading DESC, ( age * ( 1 / ( 4 * importance ) ) ) ASC
            LIMIT %(limit)s
        """

        return list(Article.objects.raw(query, context))

    @staticmethod
    def get_frontpage_sections(exclude=None):

        exclude = exclude or []
        results = {}

        sections = Section.objects.all()

        for section in sections:
            articles = Article.objects.exclude(id__in=exclude).filter(section=section,is_published=True).order_by('-published_at').select_related()[:5]
            if len(articles):
                results[section.slug] = {
                    'first': articles[0],
                    'stacked': articles[1:3],
                    'bullets': articles[3:],
                    'rest': articles[1:4],
                }

        return results

    @staticmethod
    def get_reading_list(article, ref=None, dur=None):
        if ref is not None:
            if ref == 'frontpage':
                articles = ArticleHelper.get_frontpage(exclude=[article.parent_id])
                name = 'Top Stories'
            elif ref == 'popular':
                articles = ArticleHelper.get_popular(dur=dur).exclude(pk=article.id)[:5]
                name = "Most popular this week"
        else:
            articles = article.get_related()
            name = article.section.name

        return {
            'ids': ",".join([str(a.parent_id) for a in articles]),
            'name': name
        }

    @staticmethod
    def get_years():
        # query = 'SELECT DISTINCT YEAR(published_at) FROM dispatch_article WHERE published_at IS NOT NULL ORDER BY published_at DESC'
        #
        # cursor = connection.cursor()
        # cursor.execute(query)
        #
        # results = cursor.fetchall()
        #
        # years = [r[0] for r in results]
        #
        # return filter(lambda y: y is not None, years)

        # TODO: fix this query ^ or replace with something better
        return [2017, 2016, 2015]

    @staticmethod
    def get_topic(topic_name):

        return Article.objects.filter(
            is_published=True,
            topic__name=topic_name
        )

    @staticmethod
    def get_random_articles(n, section, exclude=None):
        """Returns `n` random articles from the given section."""

        # Get all magazine articles
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
    def get_popular(dur='week'):
        """Returns the most popular articles in the time period."""

        durations = {
            'week': 7,
            'month': 30
        }

        articles = Article.objects.filter(is_published=True)

        if dur in durations:
            end = datetime.datetime.now() + datetime.timedelta(days=1)
            start = end - datetime.timedelta(days=durations[dur])
            time_range = (start, end)
            articles = articles.filter(created_at__range=(time_range))

        return articles.order_by('-views')

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

class PageHelper(object):
    @staticmethod
    def get_page(request, slug):
        if request.user.is_staff:
            try:
                page = Page.objects.get(slug=slug, head=True)
            except Article.DoesNotExist:
                raise Http404("This page does not exist.")
        else:
            try:
                page = Page.objects.get(slug=slug, is_published=True)
            except Page.DoesNotExist:
                raise Http404("This page does not exist.")
        return page
