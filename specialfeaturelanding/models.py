from .blocks import (
    QuoteBlock, 
    CustomStylingCTABlock,
)

from django.db import models
from django.db.models.fields.related import ForeignKey

from section.sectionable.models import SectionablePage

from wagtail.admin.edit_handlers import (
    MultiFieldPanel,
    StreamFieldPanel,
    HelpPanel,
)

from wagtail.core.models import Page
from wagtail.core.fields import StreamField

from wagtailmenus.models import FlatMenu
from wagtailmodelchooser.edit_handlers import ModelChooserPanel

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

    #-----Fields-----
    menu = ForeignKey(
        FlatMenu,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    content = StreamField(
        [
            ('quote', QuoteBlock(
                label="Quote Block",
            )),
            ('stylecta',CustomStylingCTABlock(
                label="Custom Styling CTA",
            )),
        ],
        null=True,
        blank=True,
    )
    content_panels = Page.content_panels + [
        ModelChooserPanel('menu'),
        MultiFieldPanel(
            [
                HelpPanel(
                    content='<h1>TODO</h1><p>Write something here</p>'
                ),
                StreamFieldPanel("content"),
            ],
            heading="Article Content",
            classname="collapsible",
        ),

    ]


    def get_context(self, request, *args, **kwargs):        
        context = super().get_context(request, *args, **kwargs)
        # for i, block in self.body:
        #     print('hello world ' + i)
        #     context['article' + i] = Article.objects.get(is_published=1, slug=block)
        return context
