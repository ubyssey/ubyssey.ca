from django.db import connection

from dispatch.apps.content.models import Article, Section

class ArticleHelper(object):

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
            FROM content_article
        """

        query_where = """
            WHERE head = 1 AND
            is_published = %(is_published)s AND
            parent_id NOT IN (%(excluded)s)
        """

        if section is not None:
            query += """
                INNER JOIN content_section on content_article.section_id = content_section.id AND content_section.slug = %(section)s
            """
        elif section_id is not None:
            query_where += " AND section_id = %(section_id)s "
        elif sections:
            query_where += "AND section_id in (SELECT id FROM content_section WHERE FIND_IN_SET(slug,%(sections)s))"

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
                articles = Article.objects.get_popular(dur=dur).exclude(pk=article.id)[:5]
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

        query = 'SELECT DISTINCT YEAR(published_at) FROM content_article ORDER BY published_at DESC'

        cursor = connection.cursor()
        cursor.execute(query)

        results = cursor.fetchall()

        years = [r[0] for r in results]

        return filter(lambda y: y is not None, years)

    @staticmethod
    def get_topic(topic_name):

        return Article.objects.filter(
            is_published=True,
            topic__name=topic_name
        )
