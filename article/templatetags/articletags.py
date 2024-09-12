from django import template
from django.utils import timezone
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

    pubdate = value.astimezone(timezone.get_current_timezone())
    today = timezone.now().astimezone(timezone.get_current_timezone())
    delta = today - pubdate
    print(today.date())
    print(pubdate.date())

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

@register.filter(name="get_id")
def get_id(value):
    from wagtail.models import Page, PageManager, SiteRootPath
    if isinstance(value, str):
        requested_path = '/ubyssey' + value
        requested =  Page.objects.filter(url_path=requested_path)
        if len(requested) == 1:
            return requested[0].id
    
    return False

@register.filter(name="group_by_date")
def group_by_date(value):
    groups = []
    for article in value:
        if len(groups) < 1:
            groups.append([article])
        else:
            if display_pubdate(groups[-1][-1].explicit_published_at) == display_pubdate(article.explicit_published_at):
                groups[-1].append(article)
            else:
                groups.append([article])
    return groups