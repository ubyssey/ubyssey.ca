import re

from random import randint, choice

from django.http import HttpResponseServerError
from django.db.models import F, OuterRef, Q, Subquery
from django.db.models.aggregates import Count
from django.utils import timezone
from django_user_agents.utils import get_user_agent

from dispatch.models import Article, Section, Subsection
from ubyssey.events.models import Event

class ArticleMixin(object):
    """
    Refactor of ArticleHelper. Largely exists to preserve identical reusable functionality in a more Django-like way than "helper classes"
    @TODO: deprecate and redesign
    """
    def __init__(self):        
        self.is_mobile = True

    def setup(self, request, *args, **kwargs):
        """
        Overrides class view setup.

        According to official Django documentation:
        'Overriding this method allows mixins to setup instance attributes for reuse in child classes. When overriding this method, you must call super().'
        https://docs.djangoproject.com/en/3.0/ref/class-based-views/base/#django.views.generic.base.View.setup
        """
        user_agent = get_user_agent(request)
        self.is_mobile = user_agent.is_mobile
        return super().setup(request, *args, **kwargs)        

    def get_article(self, request, slug):
        """If the url requested includes the querystring parameters 'version' and 'preview_id',
        get the article with the specified version and preview_id.

        Otherwise, get the published version of the article.
        """
        return Article.objects.get(request=request, slug=slug, is_published=True)

    def get_reading_time(self, article):
        word_count = 0
        words_per_min = 150
        for block in article.content:
            if block['type'] == 'paragraph':
                word_count += len(block['data'].split(' '))

        reading_time = word_count // words_per_min
        return reading_time

    def insert_ads(self, content, article_type='desktop'):
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

    def get_frontpage_qs(self, sections=[], exclude=[], limit=7, is_published=True, max_days=14):
        articles = Article.objects.filter(
            head=1,
            is_published=is_published,
            section__slug__in=sections # See this link for why you can do this instead of SQL joining: https://docs.djangoproject.com/en/3.0/topics/db/queries/#lookups-that-span-relationships
        ).exclude(
            parent_id__in=exclude
        ).order_by(
            '-published_at'
        )[:limit]
        
        return articles

    def get_frontpage_sections(self, exclude=None):

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

    def get_reading_list(self, article, ref=None, dur=None):
        articles = []
        name = None
        if ref is not None:
            if ref == 'frontpage':
                articles = list(self.get_frontpage_qs(exclude=[article.parent_id]))
                name = 'Top Stories'
            elif ref == 'popular':
                articles = self.get_popular(dur=dur).exclude(pk=article.id)[:5]
                name = "Most popular this week"
        else:
            articles = article.get_related()
            name = article.section.name

        return {
            'ids': ",".join([str(a.parent_id) for a in articles]),
            'name': name
        }

    def is_explicit(self, article):
        explicit_tags = ['sex', 'explicit']
        tags = article.tags.all().values_list('name', flat=True)
        for tag in tags:
            if tag.lower() in explicit_tags:
                return True
        return False

    def get_random_articles(self, n, section, exclude=None):
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

    def get_popular(self, dur='week'):
        """
        WARNING: views count broken, TODO rework this logic

        Returns the most popular articles in the time period.
        """

        durations = {
            'week': 7,
            'month': 30
        }

        articles = Article.objects.filter(is_published=True)

        if dur in durations:
            end = timezone.now() + timezone.timedelta(days=1)
            start = end - timezone.timedelta(days=durations[dur])
            time_range = (start, end)
            articles = articles.filter(published_at__range=(time_range))

        # return articles.order_by('-views')
        return articles.order_by('-published_at')


    def get_suggested(self, article):
        """Returns the suggested articles for a current article"""
        subsection = article.get_subsection()

        if subsection:
            return subsection.get_published_articles().exclude(id=article.id)

        return Article.objects.filter(is_published=True).order_by('-published_at').exclude(id=article.id)
        
    def get_breaking_news(self):
        """Returns breaking news stories"""
        return Article.objects.filter(is_published=True, is_breaking=True)

    def get_pinned_articles(self):
        return Article.objects.filter(is_published=True, is_pinned=True)

    def get_trending(self):
        """Returns the most trending articles in the time period."""

        DURATION = 6

        articles = Article.objects.filter(is_published=True)

        end = timezone.now()
        start = end - timezone.timedelta(hours=DURATION)
        time_range = (start, end)
        trending_articles = articles.filter(
            published_at__range=(time_range),
            # views__gt=1000)   # Removed this because it's been so corrupted in the DB
        )

        if len(trending_articles) == 0:
            trending_article = None
        else:
            trending_article = choice(trending_articles)

        return trending_article

class DispatchPublishableViewMixin(object):
    """
    Abstracts out typical function overrides when dealing with a Publishable object from the Dispatch app (i.e. and Article or a Page). Most commonly, this is to append .filter(is_published=True) to the queryset a class uses to account for non-unique slugs.
    This logic was originally in the Ubyssey app, but because it deals with Dispatch models, it may be desirable to move it 

    Attributes:

        version: the version number of a particular Dispatch article, read from a querystring. Default to None (typical case)
        preview_id: the preview_id of a particular Dispatch article, read from a querystring. Default to None (typical case)
    """
    def setup(self, request, *args, **kwargs):
        # TODO: check that this mixin is being used with a compatable class
        # Both attributes should usually be None!
        self.preview_id = request.GET.get('preview_id', None)
        self.version = request.GET.get('version', None)
        return super().setup(request, *args, **kwargs)        
    
    def get_queryset(self):
        """If the url requested includes the querystring parameters 'version' and 'preview_id',
        get the article with the specified version and preview_id.

        Otherwise, get the published version of the article.
        """
        if self.preview_id is not None and self.version is not None:
            # Special condition which should be fulfilled only when the user is trying to preview an article
            # Hence, we do the preview_id check first; that should fail in all but the case we're trying to preview
            return super().get_queryset().filter(revision_id=self.version, preview_id=self.preview_id)
        return super().get_queryset().filter(is_published=True)
    
    def render_to_response(self, context, **response_kwargs):
        """
        In design, adds to the view counter before rendering the page. We do this as late as possible to try to prevent adding to the view counter in the event of errors
        In practice this has been buggy. Possibly flag this for depreciation
        """
        # self.get_queryset().update(views=F('views')+1) # We call this at the last possible second once everything has been done correctly so that we only count successful attempts to read the article
        return super().render_to_response(context, **response_kwargs)

    def get_article_meta(self, default_image=None):
        """
        Only works with Article objects, but put here because there seems to have been
        some conflicting ideas about what can be assumed about an Article object at some point

        TODO: design a general get_meta that should work with every Publishable object.
        Then re-implement this, perhaps in ArticleMixin once that class's tangle has been tamed.
        Deprecate this method if this has been done.
        """
        try:
            meta = super().get_article_meta(default_image)
        except:
            meta = {}
        try:
            meta['image'] = self.object.featured_image.image.get_medium_url()
        except:
            meta['image'] = default_image

        meta['title'] = self.object.headline
        meta['description'] = self.object.seo_description if self.object.seo_description is not None else self.object.snippet
        meta['url'] = self.object.get_absolute_url
        meta['author'] = self.object.get_author_type_string()
        return meta

class GuideViewMixin(object):
    """
    Mixes in common context data used in most Guide templates.
    """
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        articles = Article.objects.filter(is_published=True, section__slug='guide', tags__name=self.year).order_by('published_at').select_related('subsection')
        
        academics = list(articles.filter(subsection__slug='academics'))
        ubc = list(articles.filter(subsection__slug='ubc'))
        adulting = list(articles.filter(subsection__slug='adulting'))
        sdp = list(articles.filter(subsection__slug='sdp'))
        vancouver = list(articles.filter(subsection__slug='vancouver'))

        if hasattr(self, 'object'):
            context['title'] = self.object.headline
            context['article'] = self.object
            try:
                next_a = articles.get(slug=self.object.template_fields['next_a'], is_published=True)
            except:
                next_a = None
            try:
                next_b = articles.get(slug=self.object.template_fields['next_b'], is_published=True)
            except:
                next_b = None
            context['next'] = [next_a, next_b]

        if hasattr(self, 'subsection'):
            context['subsection'] = self.subsection

        # 'articles' context variable is used for the header and footer and ought to be on every guide page

        context['articles'] = {
            'academics': academics,
            'ubc': ubc,
            'adulting': adulting,
            'sdp': sdp,
            'vancouver': vancouver
        }

        return context

class SubsectionMixin(object):
    """
    Refactor of SubsectionHelper. Largely exists to preserve identical reusable functionality in a more Django-like way than "helper classes".
    Used by Section view.
    @TODO: Deprecate in favour of e.g. fatter Section model in Dispatch
    """

    def get_subsections(self, section):
        article_query = Article.objects.filter(
           subsection_id=OuterRef("id"),
           is_published=True
        ).order_by(
            F('published_at').desc(nulls_last=True)
        )
        subsection_query = Subsection.objects.annotate(
            published_at=Subquery(
                article_query.values('published_at')[:1]
            )
        ).filter(
            is_active=True,
            section_id=section.id
        )
        return list(subsection_query)

    def get_featured_subsection_articles(self, subsection, featured_articles):
        featured_articles_ids = list(featured_articles.values_list('id', flat=True)[0:4])
        return subsection.get_published_articles().exclude(id__in=featured_articles_ids)[0:3] if subsection.get_published_articles().exclude(id__in=featured_articles_ids).exists() else subsection.get_published_articles()[0:3]

class SectionMixin(SubsectionMixin, object):
    """
    Abstracts common functionality for the View of a Section or Subsection object
    """
    model = Article # Object corresponds to the _list_ in "List" View, not the _template_ the view renders, which is where we get "Section" View from
    paginate_by = 15 # automatically adds a paginator and page_obj to the context, see https://docs.djangoproject.com/en/3.0/topics/pagination/#using-paginator-in-view

    def setup(self, request, *args, **kwargs):
        self.order = request.GET.get('order', 'newest')
        self.query = request.GET.get('q', False)
        try:
            filter_id = self.section.id
            self.featured_articles = Article.objects.filter(is_published=True).filter(Q(subsection_id=filter_id)|Q(section_id=filter_id)).order_by('-published_at')
        except AttributeError:
            return HttpResponseServerError("Check SectionMixin useage!")
        return super().setup(request, *args, **kwargs)

    def get_template_names(self):
        template_names = []        
        try:
            template_names += ['%s/%s' % (self.section.slug, self.default_template), self.default_template]
        except AttributeError:
            template_names += ['subsection.html'] # more minimal html file
        template_names += super().get_template_names()
        return template_names

    def get_queryset(self):
        if self.order == 'newest':
            order_by = '-published_at'
        else:
            order_by = 'published_at'
        article_list = super().get_queryset().filter(is_published=True).order_by(order_by)
        if self.query:
            article_list = article_list.filter(headline__icontains=self.query)
        return article_list

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        context['meta'] = {
            'title': self.section.name,
        }
        context['featured_articles'] = {
            'first': self.featured_articles[0],
            'rest': self.featured_articles[1:4]
        }
        context['order'] = self.order
        context['query'] = self.query

        return context

class ArchiveListViewMixin(object):
    """
    Designed so that one can include objects/archive.html to the template corresponding to a view, 
    without having to add much to e.g. the context data structure to get it working.
    Mix in with a ListView
    """
    paginate_by = 15

    def __get_years(self):
        """
        Returns:
            list of years such that there is an article published at that year
        """
        publish_dates = Article.objects.filter(is_published=True).dates('published_at','year',order='DESC')
        years = []

        for publish_date in publish_dates:
            years.append(publish_date.year)

        return years

    def setup(self, request, *args, **kwargs):
        """
        Sets order, page, query, youtube_regex attributes
        """
        self.order = request.GET.get('order', 'newest')
        self.page = request.GET.get('page')
        self.query = request.GET.get('q', False)
        self.youtube_regex = re.compile(r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})')
        return super().setup(request, *args, **kwargs)
    
    def get_queryset(self):
        """
        Custom queryset, because the original code this was refactored from did a tremendous amount of stuff 
        in putting together a queryset 
        """
        if self.order == 'oldest':
            publishable_order_by = 'published_at'
        else:
            publishable_order_by = '-published_at'

        article_qs = Article.objects.prefetch_related('authors', 'authors__person').select_related(
            'section', 'featured_image').filter(is_published=True).order_by(publishable_order_by)
        if self.query:         
            article_qs = article_qs.filter(headline__icontains=self.query)
        if self.year:
            article_qs = article_qs.filter(published_at__icontains=str(self.year))
        if self.section_id:
            article_qs = article_qs.filter(section=self.section_id)
        article_qs = article_qs[:7000]
        self.article_qs_exists = article_qs.exists()

        return article_qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        context['sections'] = Section.objects.all()
        context['order'] = self.order
        context['years'] = self.__get_years()
        context['q'] = self.query
        context['meta'] = { 'title': 'Archive' }

        if self.section_id:
            context['section_id'] = self.section_id
            context['section_name'] = Section.objects.get(id=self.section_id)

        filters = []
        if self.order == 'oldest':
            filters.append('order=%s' % self.order)
        if self.year is not None:
            filters.append('year=%s' % self.year)
        if self.query:
            filters.append('q=%s' % self.query)
        if self.section_id:
            filters.append('section_id=%s' % self.section_id)
        if filters:
            query_string = '?' + '&'.join(filters)
        else:
            query_string = ''
        context['query_string'] = query_string

        # Articles
        # Note part of this design is an artefact of having non-Article items appearing in the archive 
        articles_start = None
        context['articles_start_page'] = None
        context['articles_start_idx'] = None
        if self.article_qs_exists:
            articles_start = 0
            context['articles_start_page'] = articles_start // self.paginate_by + 1
            context['articles_start_idx'] = articles_start % self.paginate_by

        return context
