from django import template
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from section.models import SectionPage
import datetime

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

@register.filter(name='display_pubdate')
def display_pubdate(value):

    if value == None:
        return "Unknown"

    timedif = datetime.timedelta(hours=-7)

    pubdate = value + timedif
    today = datetime.datetime.now().replace(tzinfo=datetime.timezone(timedif)) + timedif
    delta = today - pubdate

    if delta.total_seconds() > datetime.timedelta(days=365).total_seconds():
        return pubdate.strftime("%B xx%d, %Y").replace("xx0","").replace("xx","")
    elif delta.total_seconds() > datetime.timedelta(days=1).total_seconds():
        return pubdate.strftime("%B xx%d").replace("xx0","").replace("xx","")
    elif delta.total_seconds() > datetime.timedelta(hours=5).total_seconds():
        if today.date() == pubdate.date():
            return "Today at " + pubdate.strftime("xx%I:%M %p").replace("xx0","").replace("xx","")
        return "Yesterday at " + pubdate.strftime("xx%I:%M %p").replace("xx0","").replace("xx","")

    elif delta.total_seconds() > datetime.timedelta(hours=1).total_seconds():
        hours = round(delta.total_seconds()/3600)
        if hours == 1:
            return "1 hour ago"
        else:
            return str(hours) + " hours ago"
    elif delta.total_seconds() > datetime.timedelta(minutes=1).total_seconds():
        minutes = round(delta.total_seconds()/60)
        if minutes == 1:
            return "1 minute ago"
        else:
            return str(minutes) + " minutes ago"
    
    seconds = round(delta.total_seconds())
    if seconds == 1:
        return "1 second ago"
    return str(seconds) + " seconds ago"