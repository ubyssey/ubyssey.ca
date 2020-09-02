from django.db import models

from wagtail.core.models import Page
from wagtail.core.fields import StreamField
from wagtail.admin.edit_handlers import FieldPanel, StreamFieldPanel
from streams import blocks

class HomePage(Page):
    template = 'homepage/homepage.html'
    max_count = 1

    #wagtail fields
    banner_title = models.CharField(max_length=100, blank=False, null=False)
    main_content = StreamField(
        [
            ("above_the_cut", blocks.FrontpageBlock())
        ]
    )

    #wagtail content panels
    content_panels = Page.content_panels + [
        #This is a very standard necessary in all Page objects in Wagtail
        FieldPanel('banner_title'),
        StreamFieldPanel('main_content'),
    ]