from django import template

register = template.Library()

@register.filter
def modulo(num, val):
    return num % val

@register.filter
def indexing_from(lst, start):
    return lst[start:]