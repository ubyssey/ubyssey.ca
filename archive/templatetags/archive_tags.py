from django import template
from archive.views import getArticles
from django.template.defaultfilters import stringfilter

register = template.Library()

@register.simple_tag(takes_context = True)
def modify_query_string(context, field, value):
    """
    See https://stackoverflow.com/questions/5755150/altering-one-query-parameter-in-a-url-django (accessed 2022/07/22)

    args:
        field: the field of the query string to alter
        value: the new value of the field of the query string
    return:
        modified URL of current page such that query string field value changes
    """
    dict_ = context['request'].GET.copy()      
    dict_[field] = value
    return dict_.urlencode()

@register.simple_tag(takes_context = True)
def remove_field_from_query_string(context, field):
    dict_ = context['request'].GET.copy()      
    dict_.pop(field, None) #Deletes the field if it exists, does nothing if it doesn't. Prevents KeyError
    return dict_.urlencode()

@register.filter(name='preload_first_articles')
@stringfilter
def preload_first_articles(value, number):
    return getArticles(value,0,int(number))
