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