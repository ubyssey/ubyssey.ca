from django import template
from django.utils import timezone
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from section.models import SectionPage
import datetime
import html
import re

register = template.Library()

@register.filter(name="normalize_redesign_byline")
@stringfilter
def normalize_redesign_byline(value):
    """Normalize legacy credit prose while preserving linked contributor names."""
    def unwrap_credit_label(match):
        label = re.sub(r"(?i)^with\s+", "", match.group(2)).lower()
        return f"{label} {match.group(1)}{match.group(3).strip()}{match.group(4)}"

    value = re.sub(
        r'(?is)(<a\b[^>]*>)\s*((?:with\s+)?(?:photos?|video|illustrations?)\s+by)\s+([^<]+)(</a>)',
        unwrap_credit_label,
        value,
    )
    value = re.sub(r"(?i)^\s*(?:words|videos?)\s+by\s*", "", value)
    value = re.sub(
        r"(?i)\bwith\s+(photos?|video|illustrations?)\s+by\b\s*",
        lambda match: f"{match.group(1).lower()} by ",
        value,
    )
    value = re.sub(
        r"(?i)\b(photos?|video|illustrations?)\s+by\b",
        lambda match: f"{match.group(1).lower()} by",
        value,
    )
    value = re.sub(r"(?i)^\s*by\s+", "", value)
    return value.strip()


@register.filter(name="caption_needs_credit")
def caption_needs_credit(caption, credit):
    """Avoid repeating a credit already present in a rich-text caption."""
    def normalize(value):
        plain = re.sub(r"<[^>]+>", " ", str(value or ""))
        return " ".join(html.unescape(plain).lower().split())

    caption_text = normalize(caption)
    credit_text = normalize(credit)
    return bool(credit_text and credit_text not in caption_text)


def _redesign_contributor_name(contributor):
    author = getattr(contributor, "author", None)
    name = getattr(contributor, "author_alias", "") or getattr(author, "full_name", "")
    url = getattr(author, "url", "")
    return format_html('<a href="{}">{}</a>', url, name) if url else name


def _redesign_name_list(contributors):
    names = [str(_redesign_contributor_name(contributor)) for contributor in contributors]
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return f"{', '.join(names[:-1])} and {names[-1]}"


@register.filter(name="format_redesign_extended_byline")
def format_redesign_extended_byline(contributors):
    """Render contributor credits using the UBSY_NTE editorial sentence rules."""
    grouped = {}
    for contributor in contributors or []:
        grouped.setdefault(getattr(contributor, "author_role", ""), []).append(contributor)

    sentences = []
    role_copy = {
        "backfield_editor": ("was this story's backfield editor.", "were the backfield editors for this story."),
        "copy_editor": ("was the copy editor.", "were the copy editors."),
    }
    for role in ("backfield_editor", "copy_editor"):
        people = grouped.get(role, [])
        if people:
            singular, plural = role_copy[role]
            sentences.append(f"{_redesign_name_list(people)} {singular if len(people) == 1 else plural}")

    photographers = grouped.get("photographer", [])
    photo_editors = grouped.get("photo_editor", [])
    if photographers and photo_editors:
        photographer_names = {str(_redesign_contributor_name(person)) for person in photographers}
        photo_editor_names = {str(_redesign_contributor_name(person)) for person in photo_editors}
        if photographer_names == photo_editor_names:
            sentences.append(f"{_redesign_name_list(photographers)} took and edited the photos.")
        else:
            sentences.append(f"{_redesign_name_list(photographers)} took the photos, which were edited by {_redesign_name_list(photo_editors)}.")
    elif photographers:
        sentences.append(f"{_redesign_name_list(photographers)} took the photos.")
    elif photo_editors:
        sentences.append(f"The photos were edited by {_redesign_name_list(photo_editors)}.")
    illustrators = grouped.get("illustrator", [])
    graphics_editors = grouped.get("graphics_editor", [])
    if illustrators and graphics_editors:
        sentences.append(f"{_redesign_name_list(illustrators)} created the graphics, which were edited by {_redesign_name_list(graphics_editors)}.")
    elif illustrators:
        sentences.append(f"{_redesign_name_list(illustrators)} created the graphics.")
    elif graphics_editors:
        sentences.append(f"The graphics were edited by {_redesign_name_list(graphics_editors)}.")
    return mark_safe(" ".join(sentences))

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
    
    if value == None or value == "":
        return "Unknown"

    pubdate = value.astimezone(timezone.get_current_timezone())
    today = timezone.now().astimezone(timezone.get_current_timezone())
    delta = today - pubdate

    if delta.total_seconds() > datetime.timedelta(days=365).total_seconds():
        return pubdate.strftime("%B xx%d, %Y").replace("xx0","").replace("xx","")
    elif delta.total_seconds() > datetime.timedelta(days=1).total_seconds():
        return pubdate.strftime("%B xx%d").replace("xx0","").replace("xx","")
    elif delta.total_seconds() > datetime.timedelta(hours=5).total_seconds():
        if today.date() == pubdate.date():
            return "Today"
        return "Yesterday"

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

@register.filter(name='time_ago')
def time_ago(value):

    if value == None:
        return "Unknown"

    pubdate = value.astimezone(timezone.get_current_timezone())
    today = timezone.now().astimezone(timezone.get_current_timezone())
    delta = today - pubdate

    if delta.total_seconds() > datetime.timedelta(days=7).total_seconds():
        delta = round(delta.total_seconds()/(3600*24*7))
        unit = "w"    
    elif delta.total_seconds() > datetime.timedelta(days=1).total_seconds():
        delta = round(delta.total_seconds()/(3600*24))
        unit = "d"
    elif delta.total_seconds() > datetime.timedelta(hours=1).total_seconds():
        delta = round(delta.total_seconds()/3600)
        unit = "h"
    elif delta.total_seconds() > datetime.timedelta(minutes=1).total_seconds():
        delta = round(delta.total_seconds()/60)
        unit = "m"
    else:
        delta = round(delta.total_seconds())
        unit = "s"

    return str(delta) + unit + " ago"

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
        if hasattr(article, 'explicit_published_at'):
            article.pubTime = article.explicit_published_at
        else:
            article.pubTime = article.first_published_at
        if len(groups) < 1:
            groups.append([article])
        else:
            if display_pubdate(groups[-1][-1].pubTime) == display_pubdate(article.pubTime):
                groups[-1].append(article)
            else:
                groups.append([article])
    return groups
