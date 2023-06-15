from django.db.models.query import QuerySet
from section.sectionable.models import SectionablePage

from article.models import ArticlePage

from django.core.cache import cache
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import models
from django.db.models.fields import CharField, BooleanField, TextField, SlugField
from django.db.models.fields.related import ForeignKey
from django.shortcuts import render

from modelcluster.models import ClusterableModel
from modelcluster.fields import ParentalKey


from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel, PageChooserPanel
from wagtail.core import models as wagtail_core_models
from wagtail.core.models import Page
from wagtail.contrib.routable_page.models import route, RoutablePageMixin
from wagtail.search import index
from wagtail.snippets.edit_handlers import SnippetChooserPanel
from wagtail.snippets.models import register_snippet


class SubSectionPage(RoutablePageMixin, SectionablePage):

    parent_page_types = [
        'home.HomePage',
        'section.SectionPage',
    ]

    subpage_types = [
        'article.ArticlePage',
    ]

    show_in_menus_default = True

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        return context
    
    def save(self, *args, **kwargs):
        self.current_section = self.slug
        return Page.save(self,*args, **kwargs)

    class Meta:
        verbose_name = "Sub-section"
        verbose_name_plural = "Sub-sections"

