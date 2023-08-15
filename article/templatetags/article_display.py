from django import template

register = template.Library()


@register.filter
def modulo(num, val):
    return num % val


@register.filter
def indexing_from(lst, start):
    return lst[start:]


@register.filter
def split(value, num):
    result = []
    i = 0
    while i < len(value):
        result.append(value[i : i + num])
        i = i + num
    return result
