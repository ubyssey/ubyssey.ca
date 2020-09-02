from django.db import models

from wagtail.core.models import Page
from wagtail.admin.edit_handlers import FieldPanel

class HomePage(Page):
    template = 'homepage/homepage.html'
    max_count = 1
    banner_title = models.CharField(max_length=100, blank=False, null=False)

    content_panels = Page.content_panels + [
        #This is a very standard necessary in all Page objects in Wagtail
        FieldPanel('banner_title'),
    ]