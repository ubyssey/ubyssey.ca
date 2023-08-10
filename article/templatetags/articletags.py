from django import template
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from section.models import SectionPage

register = template.Library()

@register.filter(name='get_label')
def get_label(value):
    if value.get_parent().get_specific().label_svg == None:
        return False
    else:
        return value.get_parent().get_specific().label_svg.url

@register.filter(name='get_colour')
def get_colour(value):
    pageColour = value.colour
    if value.use_parent_colour:
        if value.get_parent() is not None:
            parent_page = value.get_parent().specific
            if hasattr(parent_page,'colour'):
                pageColour = value.colour = parent_page.colour

    return pageColour

@register.filter(name='get_section_link')
def get_section_link(value):
    return value.get_parent().url

@register.filter(name='get_section_title')
def get_section_title(value):
    return value.get_parent().title