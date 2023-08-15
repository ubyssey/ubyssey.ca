from django import template
from django.template.defaultfilters import stringfilter

from infinitefeed.views import getArticles

register = template.Library()


@register.filter(name="preload_articles")
def preload_articles(value, number):
    return getArticles(value, 0, int(number))
