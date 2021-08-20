from django.db import models

from section.sectionable.models import SectionablePage

from wagtail.core.models import Page

class SpecialLandingPage(SectionablePage):
    """
    This is the general model for "special features" landing pages, such as for the guide, or a magazine.
    """
    template = "specialfeatureslanding/base.html"

    parent_page_types = [
        'section.SectionPage',
        'specialfeaturelanding.SpecialLandingPage',
    ]

    subpage_types = [
        'specialfeaturelanding.SpecialLandingPage',
        'article.ArticlePage',
    ]
    
    show_in_menus_default = True

    content_panels = Page.content_panels + [
    ]

    def get_context(self, request, *args, **kwargs):        
        context = super().get_context(request, *args, **kwargs)
        # for i, block in self.body:
        #     print('hello world ' + i)
        #     context['article' + i] = Article.objects.get(is_published=1, slug=block)
        return context
