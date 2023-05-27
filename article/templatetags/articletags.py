from django import template
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from section.models import SectionPage

register = template.Library()

@register.filter(name='get_label')
@stringfilter
def get_label(value):
    if SectionPage.objects.get(slug=value).label_svg == None:
        return False
    else:
        return SectionPage.objects.get(slug=value).label_svg.url

@register.filter(name='get_colour')
def get_label(value):
    pageColour = value.colour
    if value.use_parent_colour:
        if value.get_parent() is not None:
            parent_page = value.get_parent().specific
            if hasattr(parent_page,'colour'):
                pageColour = value.colour = parent_page.colour

    return pageColour