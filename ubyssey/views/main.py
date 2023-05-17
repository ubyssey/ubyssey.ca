from datetime import datetime
import json
import re

from itertools import chain

from django.http import HttpResponse, Http404, JsonResponse
from django.shortcuts import render, redirect
from django.conf import settings
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.urls import reverse

from dispatch.models import Article, Section, Subsection, Topic, Page, Person, Podcast, PodcastEpisode, Video, Author, Image
from django.views.generic.base import TemplateView
from django.views.generic.detail import DetailView
from django.views.generic.list import ListView
from ubyssey.helpers import ArticleHelper, SubsectionHelper, PodcastHelper, NationalsHelper, FoodInsecurityHelper, VideoHelper
from ubyssey.mixins import ArticleMixin, ArchiveListViewMixin, DispatchPublishableViewMixin, SectionMixin, SubsectionMixin

def parse_int_or_none(maybe_int):
    try:
        return int(maybe_int)
    except (TypeError, ValueError):
        return None

def ads_txt(request):
    return redirect(settings.ADS_TXT_URL)


class HomePageAJAX(TemplateView):
    """
    Based off: https://stackoverflow.com/questions/8059160/django-apps-using-class-based-views-and-ajax
    """

    def render_to_response(self, context, **response_kwargs):
        if self.request.is_ajax():
            return JsonResponse({'foo': 'bar'})
        else:
            return Http404

class HomePageView(ArticleMixin, TemplateView):
    """
    View logic for the page the reader first sees upon going to https://ubyssey.ca/
    """
    template_name = 'homepage/base.html'
    youtube_regex = re.compile(r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})')

    def get_context_data(self, **kwargs):        
        context = super().get_context_data(**kwargs)

        #set context stuff that will be used for other context stuff as we go
        context['title'] = 'The Ubyssey - UBC\'s official student newspaper'
        context['breaking'] = self.get_breaking_news().first()
        context['special_message'] = settings.SPECIAL_MESSAGE_AVAILABLE
        
        # context['subsection_banner_message'] = Subsection.objects.first().description

        #set 'articles' section of context. Do some speed optimization for getting sections later
        frontpage = self.get_frontpage_qs(
            sections=('news', 'culture', 'opinion', 'sports', 'features', 'science'),
            max_days=7
        ).select_related(
            'section'
        )
        frontpage = list(frontpage)
        try:
            #TODO: fail more gracefully!
            articles = {
                'primary': frontpage[0],
                'secondary': frontpage[1],
                'thumbs': frontpage[2:4],
                'bullets': frontpage[4:6],
                # Get random trending article
                # 'trending': trending_article,
                'breaking': context['breaking']
             }
        except IndexError:
            raise Exception('Not enough articles to populate the frontpage!')
        context['articles'] = articles

        #context['elections'] = self.get_topic('AMS Elections').order_by('-published_at')

        #set 'sections' entry of context
        frontpage_ids = [int(a.id) for a in frontpage[:2]]
        context['sections'] = self.get_frontpage_sections(exclude=frontpage_ids)
               
        #set 'is_mobile' entry of context
        context['is_mobile'] = self.is_mobile

        context['podcast'] = None
        context['video'] = None
        #set 'meta' entry of context
        context['meta'] = {
                'title': context['title'],
                'description': 'Weekly student newspaper of the University of British Columbia.',
                'url': settings.BASE_URL
        }
        #set all the parts of the context that only need a single line
        # context['popular'] = self.get_popular()[:5]
        context['blog'] = list(self.get_frontpage_qs(sections=['blog'], limit=5))
        context['day_of_week'] = datetime.now().weekday()
        
        return context

class ArticleView(DispatchPublishableViewMixin, ArticleMixin, DetailView):
    """
    Initializes attributes from URL: section, slug/

    Please consult official Django documentation on DetailView: 
    https://docs.djangoproject.com/en/3.0/ref/class-based-views/generic-display/#django.views.generic.detail.DetailView
    """
    model = Article #is queried by section and slug
    
    def setup(self, request, *args, **kwargs):
        """
        Overrides class view setup.

        According to official Django documentation:
        'Overriding this method allows mixins to setup instance attributes for reuse in child classes. When overriding this method, you must call super().'
        https://docs.djangoproject.com/en/3.0/ref/class-based-views/base/#django.views.generic.base.View.setup
        """
        self.ref = request.GET.get('ref', None)
        self.dur = request.GET.get('dur', None)
        return super().setup(request, *args, **kwargs)        

    def get_template_names(self):
        """
        Returns a LIST of strings that represent template files (almost always HTML)

        Because this is called during render_to_response(), but also appears earlier than get_queryset in the DetailView flowchart,
        we use an if conditional to confirm whether the Article object has been queried and set
        """
        template_names = []
        if self.object:
            object_section_slug = str(self.object.section.slug)
            object_template = str(self.object.get_template_path())
            template_names += ['%s/%s' % (object_section_slug, object_template), object_template, 'article/default.html'] 
        template_names += super().get_template_names()
        return template_names

    def get_context_data(self, **kwargs):
        """
        We're overriding the defaults listed here:
        https://docs.djangoproject.com/en/3.0/ref/class-based-views/mixins-single-object/
        """        
        context = super().get_context_data(**kwargs)
        article = self.object
        context['title'] = '%s - The Ubyssey' % (article.headline)
        context['breaking'] = self.get_breaking_news().exclude(id=article.id).first()
        context['special_message'] = settings.SPECIAL_MESSAGE_AVAILABLE

        # determine if user is viewing from mobile
        article_type = 'mobile' if self.is_mobile else 'desktop'

        # add a few fields to the article if it happens to have a "special" template
        if self.object.template == 'timeline':
            timeline_tag = article.tags.filter(name__icontains='timeline-')
            timeline_articles = Article.objects.filter(tags__in=timeline_tag, is_published=True)

            timeline_articles = list(timeline_articles.values('parent_id', 'template_data', 'slug', 'headline', 'featured_image'))
            
            for a in timeline_articles:
                # convert JSON field from string to dict if needed
                if isinstance(a['template_data'], str):
                    a['template_data'] = json.loads(a['template_data'])
               
            sorted_timeline_articles = sorted(
                timeline_articles,
                key=lambda a: a['template_data']['timeline_date']
            )

            for i, a in enumerate(sorted_timeline_articles):
                try:
                    sorted_timeline_articles[i]['featured_image'] = a.featured_image.image.get_thumbnail_url()
                except:
                    sorted_timeline_articles[i]['featured_image'] = None

            article.timeline_articles = json.dumps(sorted_timeline_articles)
            article.timeline_title = list(timeline_tag)[0].name.replace('timeline-', '').replace('-', ' ')

        if self.object.template == 'soccer-nationals':
         
            teamData = NationalsHelper.prepare_data(self.object.content)
         
            self.object.content = teamData['content']
            self.object.team_data = json.dumps(teamData['code'])

        if self.object.template == 'food-insecurity':
            data = FoodInsecurityHelper.prepare_data(article.content)
            article.content = data['content']
            article.point_data = json.dumps(data['code']) if data['code'] is not None else None

        # set explicit status (TODO: ADDRESS SIDE EFFECT: inserting ads!)
        context['explicit'] = self.is_explicit(self.object)        
        if not context['explicit']:
            self.object.content = self.insert_ads(self.object.content, article_type)

        # set the rest of the context
        context['article'] = self.object
        context['base_template'] = 'base.html'

        context['meta'] = self.get_article_meta()

        # troublesome elements TODO FIX!!
        context['popular'] = None
        context['reading_list'] = None
        context['reading_time'] = None
        context['suggested'] = None

        # context['popular'] = self.get_popular()[:5]
        # context['reading_list'] = self.get_reading_list(self.object, ref=self.ref, dur=self.dur) # Dependent on get_frontpage, get_popular, get_related 
        # context['reading_time'] = self.get_reading_time(self.object)
        # context['suggested'] = self.get_suggested(self.object)[:3]
        # context['suggested'] = lambda: ArticleHelper.get_random_articles(2, section, exclude=article.id),

        return context

class SectionView(SectionMixin, ListView):
    """
    For rendering the list of articles corresponding to a section.
    NOT a DetailView of the "Section" model.
    
    Expects to get Section slug from URL and raises Http404 if not present
    """

    def setup(self, request, *args, **kwargs):
        self.default_template = 'section.html'
        try:
            self.section = Section.objects.get(slug=kwargs['slug']) 
        except Section.DoesNotExist:
            raise Http404() #TODO: figure out if 404 handling is consistent throughout our app!

        return super().setup(request, *args, **kwargs)

    def get_queryset(self):
        return super().get_queryset().filter(section=self.section)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        featured_subsection = None
        featured_subsection_articles = None

        context['subsections'] = self.get_subsections(self.section)
        if context['subsections']:
            featured_subsection = context['subsections'][0]
            featured_subsection_articles = self.get_featured_subsection_articles(featured_subsection, self.featured_articles)
        
        context['featured_subsection'] = {
            'subsection': featured_subsection,
            'articles' : featured_subsection_articles
        }

        context['section'] = self.section
        context['type'] = 'section'
        return context

class SubsectionView(SectionMixin, ListView):
    """
    For subsection views. Largely the same in functionality to SectionView, but subsections don't have any polymorphism with Sections, unfortunately.
    """
    def setup(self, request, *args, **kwargs):
        self.default_template = 'subsection.html'
        try:
            self.section = Subsection.objects.get(slug=kwargs['slug']) 
        except:
            raise Http404()
        return super().setup(request, *args, **kwargs)
    def get_queryset(self):
        return super().get_queryset().filter(subsection=self.section)
        
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['subsection'] = self.section
        context['type'] = 'subsection'
        
        return context

class PageView(DispatchPublishableViewMixin, DetailView):
    """
    For special pages such as "About", "Volunteer", etc.
    Occasionally called by "legacy" URLs which otherwise share a pattern with Section URLs.
    This is due to the need to maintain permalinks after correcting a design flaw from an earlier version of this app.
    """
    model = Page
  
    def get_template_names(self):
        template_names = []
        template_path = self.object.get_template_path()
        if template_path != 'article/default.html':
            template_names = [template_path, 'page/base.html']
        else:
            template_names = ['page/base.html']
        return template_names

    def get_context_data(self, **kwargs):
        try:
            image = self.object.featured_image.image.get_medium_url()
        except:
            image = None

        context = {
            'meta': {
                'title': self.object.title,
                'image': image,
                'url': settings.BASE_URL[:-1] + reverse('page', args=[self.object.slug]), #TODO: double check this
                'description': self.object.snippet if self.object.snippet else ''
            },
            'page': self.object
        }
        # assert False
        return context

class PodcastView(DetailView):
    """
    DetailView. Expects to get slug from URL
    """
    model = Podcast

    def get_template_names(self):
        return ['podcasts/podcast.html']

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        podcast_id = self.object.id
        podcast_slug = self.object.slug

        episode_list = PodcastEpisode.objects.filter(podcast_id=podcast_id).order_by('-published_at')

        episode_urls = []
        for episode in episode_list:
            episode_urls += "%spodcast/%s#%s" % (settings.BASE_URL, podcast_slug, episode.id)
            
        episodes = list(zip(episode_list, episode_urls))

        url = "%spodcast/episodes" % (settings.BASE_URL)
        context['podcast'] = self.object
        context['url'] = url
        context['episodes'] = episodes
        return context

class VideoView(ListView):
    """
    ListView. Gets slug from URL
    """
    model = Video
    paginate_by = 5
    def get_template_names(self):
        return ['videos/videos.html']
    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['meta'] = {
            'title': 'Video'
        }
        return context

class ArticleAjaxView(DispatchPublishableViewMixin, DetailView):
    model = Article

    def setup(self, request, *args, **kwargs):
        article = Article.objects.get(id=kwargs['pk'])
        authors = article.authors.all()
        self.authors_json = [a.person.full_name for a in authors]
        return super().setup(request, *args, **kwargs)
    def get_template_names(self):
        return ['author.html']

    def get_context_data(self, **kwargs):
        """
        Possibly rendered useless by overriding render_to_response in such a way that does not use this. 
        Was originally part of the pre-refactored version. Preserved here anyways.
        """
        context = {
            'article': self.object,
            'authors_json': self.authors_json,
            'base_template': 'blank.html'
        }
        return context

    def render_to_response(self, context, **response_kwargs):
        article = self.object
        try:
            featured_image = article.featured_image.image.get_thumbnail_url()
        except:
            featured_image = None

        data = {
            'id': article.parent_id,
            'headline': article.headline,
            'url': article.get_absolute_url(),
            'authors': self.authors_json,
            'published_at': str(article.published_at),
            'featured_image': featured_image
        }

        return HttpResponse(json.dumps(data), content_type='application/json')

class AuthorView(DetailView):
    """
    DetailView. Shares a lot of expected behaviour with ArchiveView.
    TODO: rework to use ArchiveListViewMixin
    """

    model = Person
    
    def setup(self, request, *args, **kwargs):
        self.order = request.GET.get('order', 'newest')
        self.page = request.GET.get('page')
        self.query = request.GET.get('q', False)
        self.youtube_regex = re.compile(r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})')

        return super().setup(request, *args, **kwargs)

    def get_template_names(self):
        return ['author.html']

    def get_context_data(self, **kwargs):
        """
        TODO: the logic in get_context_data in AuthorView and ArchiveView is very similar and very bloated. Abstract it out.
        """
        person = self.object
        order = self.order
        page = self.page
        query = self.query
        context = super().get_context_data(**kwargs)

        if order == 'newest':
            publishable_order_by = '-published_at'
            media_order_by = '-created_at'
        else:
            publishable_order_by = 'published_at'
            media_order_by = 'created_at'

        article_list = Article.objects.filter(authors__person=person, is_published=True).order_by(publishable_order_by)
        video_list = Video.objects.filter(authors__person=person).order_by(media_order_by)
        image_list = Image.objects.filter(authors__person=person).order_by(media_order_by)
        
        podcast_list = Podcast.objects.filter(author=person.full_name)
        podcast = Podcast.objects.all()[:1].get()
        episode_list = PodcastEpisode.objects.filter(podcast_id=podcast.id, author=person.full_name).order_by(publishable_order_by)

        if query:
            article_list = article_list.filter(headline__icontains=query)
            video_list = video_list.filter(title__icontains=query)
            image_list = image_list.filter(title__icontains=query)
            podcast_list = podcast_list.filter(title__icontains=query)
            episode_list = episode_list.filter(title__icontains=query)
            
        episode_urls = []
        for episode in episode_list:
            episode_urls += [PodcastHelper.get_podcast_episode_url(episode.podcast_id, episode.id)]
        
        episodes = list(zip(episode_list, episode_urls))
        podcasts = list(zip([podcast], [PodcastHelper.get_podcast_url(id=podcast.id)])) if podcast_list is not None and podcast_list.exists() else []

        for index, image in enumerate(image_list):
            image_list[index].imageAuthors = []
            for author in image.authors.all():
                person_id = Author.objects.get(id=author.id).person_id
                author_person = Person.objects.get(id=person_id)
                image_list[index].imageAuthors.append({'name': author_person.full_name, 'link': VideoHelper.get_media_author_url(author_person.slug)})

            image_list[index].numAuthors = len(image.imageAuthors)

        for index, video in enumerate(video_list):
            video_list[index].videoAuthors = []
            for author in video.authors.all():
                person_id = Author.objects.get(id=author.id).person_id
                author_person = Person.objects.get(id=person_id)
                video_list[index].videoAuthors.append({'name': author_person.full_name, 'link': VideoHelper.get_media_author_url(author_person.slug)})

            match = self.youtube_regex.match(video.url)
            if match:
                video_list[index].youtube_slug = match.group('id')
            else:
                UbysseyTheme.logger.warning("Could not parse youtube slug from given url: %s", video.url)
            video_list[index].numAuthors = len(video.videoAuthors)
            video_list[index].video_url = VideoHelper.get_video_url(video.id)

        object_list = list(chain(article_list, video_list, image_list, podcasts, episodes))
        objects_per_page = 15
        paginator = Paginator(object_list, objects_per_page) # Show 15 objects per page

        try:
            articles = paginator.page(page)
        except PageNotAnInteger:
            # If page is not an integer, deliver first page.
            articles = paginator.page(1)
        except EmptyPage:
            # If page is out of range (e.g. 9999), deliver last page of results.
            articles = paginator.page(paginator.num_pages)

        context = {
            'meta': {
                'title': person.full_name,
                'image': person.get_image_url if person.image is not None else None,
            },
            'person': person,
            'page_obj': articles,
            'order': order,
            'q': query
        }

        articles_start = 0 if article_list is not None and article_list.exists() else None
        context['articles_start_page'] = articles_start // objects_per_page + 1 if articles_start is not None else None
        context['articles_start_idx'] = articles_start % objects_per_page if articles_start is not None else None
        
        videos_start = len(article_list) if video_list is not None and video_list.exists() else None
        context['videos_start_page'] = videos_start // objects_per_page + 1 if videos_start is not None else None
        context['videos_start_idx'] = videos_start % objects_per_page if videos_start is not None else None
        
        images_start = len(article_list) + len(video_list) if image_list is not None and image_list.exists() else None
        context['images_start_page'] = images_start // objects_per_page + 1 if images_start is not None else None
        context['images_start_idx'] = images_start % objects_per_page if images_start is not None else None
        
        podcasts_start = len(article_list) + len(video_list) + len(image_list) if podcasts is not None and len(podcasts) > 0 else None
        context['podcasts_start_page'] = podcasts_start // objects_per_page + 1 if podcasts_start is not None else None
        context['podcasts_start_idx'] = podcasts_start % objects_per_page if podcasts_start is not None else None
        
        episodes_start = len(article_list) + len(video_list) + len(image_list) + len(podcasts) if episodes is not None and len(episodes) > 0 else None
        context['episodes_start_page'] = episodes_start // objects_per_page + 1 if episodes_start is not None else None
        context['episodes_start_idx'] = episodes_start % objects_per_page if episodes_start is not None else None

        return context

class ArchiveView(ArchiveListViewMixin, ListView):
    """
    View for http://ubyssey.ca/archive/

    Bugs:
        Cannot click on "All years" or "All sections" once you have selected a particular year or section
    """

    def __parse_int_or_none(self, maybe_int):
        """
        Private helper that enforces stricter discipline on section id and year values in request headers.
        
        Returns:
            maybe_int cast to an integer or None if the cast fails. 
        """
        try:
            return int(maybe_int)
        except (TypeError, ValueError):
            return None

    def setup(self, request, *args, **kwargs):
        """
        Sets self.section_id and self.year variables. These variables are optional for a ArchiveListViewMixin, 
        but it will add features to the archive page if they are present.
        """        
        self.section_id = self.__parse_int_or_none(request.GET.get('section_id'))
        self.year = self.__parse_int_or_none(request.GET.get('year'))
        return super().setup(request, *args, **kwargs)
    
    def get_template_names(self):
        return ['archive.html']

class ElectionsView(TemplateView):
    """
    Currently unused, minimally refactored from its function view form.
    Preserved at the moment for possible future use.
    """
    template_name = 'section.html'

    def get_context_data(self, **kwargs):
        articles = Article.objects.filter(is_published=True, topic__name='AMS Elections').order_by('-published_at')
        topic = Topic.objects.filter(name='AMS Elections')[0]

        context = {
            'meta': {
                'title': '2017 AMS Elections'
            },
            'section': {
                'name': '2017 AMS Elections',
                'slug': 'elections',
                'id': topic.id
            },
            'type': 'topic',
            'articles': {
                'first': articles[0],
                'rest': articles[1:9]
            }
        }

        return context

class TopicView(DetailView):
    """
    Currently unused, minimally refactored from its function view form.
    Preserved at the moment for possible future use.
    """
    model = Topic

    def get_template_names(self):
        return ['section.html']

    def get_context_data(self, **kwargs):
        topic = self.object
        articles = Article.objects.filter(topic=topic, is_published=True).order_by('-published_at')

        context = {
            'meta': {
                'title': topic.name
            },
            'section': topic,
            'type': 'topic',
            'articles': { #TODO: FIGURE OUT IF SHOULD BE page_obj
                'first': articles[0] if articles else None,
                'rest': articles[1:9]
            }
        }
        return context

class IsolationView(TemplateView):
    """
    Ugly, unreusable View for "Isolation" special feature. Do not use this View for anything else!

    TODO: replace with general landing pages
    """
    
    template_name = 'isolation/landing.html'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        articles_qs = Article.objects.filter(
            # is_published=True, 
            section__slug='culture',
            subsection__slug='isolation',
        )
        try:
            context['article1'] = articles_qs.get(head=True, slug='boredom-and-binging')
            context['article2'] = articles_qs.get(head=True, slug='in-full-bloom')
            context['article3'] = articles_qs.get(head=True, slug='temperature-checks')
            context['article4'] = articles_qs.get(head=True, slug='a-breath-of-fresh-air')
            context['article5'] = articles_qs.get(head=True, slug='paradise-found')
            context['article6'] = articles_qs.get(head=True, slug='under-water')
            context['article7'] = articles_qs.get(head=True, slug='healing-wounds')
            context['article8'] = articles_qs.get(head=True, slug='feeling-raw')
        except Article.DoesNotExist:
            print("Did not find one of the Isolation articles in the db!\n")

        return context

class UbysseyTheme:
    @staticmethod
    def centennial(request):
        return render(request, 'centennial.html', {})
