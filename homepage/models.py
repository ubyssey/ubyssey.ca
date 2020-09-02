from django.db import models

from wagtail.core.models import Page

class HomePage(Page):
    template = 'homepage/base.html'