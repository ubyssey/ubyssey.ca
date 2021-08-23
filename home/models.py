from . import blocks as homeblocks

from article.models import ArticlePage
from section.models import SectionPage , CategorySnippet
from django.db import models

from wagtail.admin.edit_handlers import FieldPanel, StreamFieldPanel
from wagtail.core.models import Page
from wagtail.core.fields import StreamField

# Create your models here.

class HomePage(Page):
    show_in_menus_default = True
    template = "home/home_page.html"

    ajax_template = "home/ajax_section.html"
    
    parent_page_types = [
        'wagtailcore.Page',
    ]

    subpage_types = [
        'section.SectionPage',
        'authors.AllAuthorsPage',
    ]

    sections_stream = StreamField(
        [
            ("home_page_section_block", homeblocks.HomepageFeaturedSectionBlock())
        ],
        null=True,
        blank=True,
    )

    content_panels = Page.content_panels + [
        StreamFieldPanel("sections_stream", heading="Sections"),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        childrenPages = self.get_children().specific().type(SectionPage)
        qs = ArticlePage.objects.live().public().order_by('-last_published_at')
        context['above_cut_articles'] = qs[:6]
        context['breaking_news_article'] = qs.filter(is_breaking=True)

        context['News'] = self.get_section_articles(section_slug = 'news')
        context['Culture'] = self.get_section_articles(section_slug = 'culture')
        context['Science'] = self.get_section_articles(section_slug = 'science')
        context['Sports'] = self.get_section_articles(section_slug = 'sports')
        context['Opinion'] = self.get_section_articles(section_slug = 'opinion')
        context['Features'] = self.get_section_articles(section_slug = 'features')

        ajax_section_blocks = []

        #remove "blog" from the sections that are about to be loaded because "blog" is a section that will be loaded on the right-side bar under digital print issuses on the homepage
        for section_stream in self.sections_stream:
            if(str(section_stream.value['section']) == "Blog" and SectionPage.objects.get(slug = "blog") is not None):
                context['blog'] = self.get_section_articles(section_slug='blog')

            for section in childrenPages:
                  if(str(section_stream.value['section']) == section.title and section.title != "Blog"):
                        ajax_section_blocks.append(section)
                  

        #if the request is ajax, it will return the requested 'section' and the feature articles under that section     
        if request.is_ajax():
            # This is the index for which the section will be loaded onto the homepage
            # section_count is going to be updated in the frontend after each repsonse is recieved. Check lazyloading-wagtail.js
            section_count = int(request.GET.get('section_count'))

            if section_count < len(ajax_section_blocks):
                context[ 'feature_articles'] = ajax_section_blocks[section_count].get_featured_articles()
                context['section_name'] = ajax_section_blocks[section_count].title
        return context

    #takes a section_slug and returns the feature articles for that section
    def get_section_articles(self, section_slug):

        sectionPage = SectionPage.objects.get(slug = section_slug)
        
        return sectionPage.get_featured_articles()

    def get_all_section_slug(self):
        
        allsection_slug = []
        allsectionPages = SectionPage.objects.all()

        for section in allsectionPages:
            allsection_slug.append(section.slug)

        return allsection_slug