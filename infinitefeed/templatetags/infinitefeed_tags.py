from django import template
from infinitefeed.views import getArticles
from django.template.defaultfilters import stringfilter

register = template.Library()

@register.filter(name='preload_articles')
def preload_articles(value, number):
    return getArticles(value,0,int(number))