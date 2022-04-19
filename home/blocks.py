"""
Blocks used on the home page of the site
"""

from django import forms
from django.db import models
from dispatch.models import Section

from wagtail.core import blocks
from wagtail.core.blocks import field_block
from wagtail.admin.edit_handlers import PageChooserPanel


class SectionChooserBlock(blocks.ChooserBlock):
    # based off code from:
    # https://groups.google.com/g/wagtail/c/S26h5GP9_Fk?pli=1
    # maybe move to a different namespace
    target_model = Section
    widget = forms.Select

# non-News section blocks
class HomePageSectionBlock(blocks.StructBlock):
    # section = blocks.CharBlock(required=True)

    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )

    class Meta:
        template = "home/stream_blocks/section_non_news.html"


# News section block
class HomePageFeaturedSectionBlock(blocks.StructBlock):

    section = field_block.PageChooserBlock(
        page_type='section.SectionPage'
    )

    class Meta:
        template = "home/stream_blocks/section_news.html"

