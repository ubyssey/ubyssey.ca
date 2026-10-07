# 9/30/26 - Misha - Class dedicated to dropcaps/droptags.
import re

from django.utils.safestring import mark_safe
from wagtail.rich_text import expand_db_html
from django import template

register = template.Library()

_P_BETWEEN = re.compile(r"</p>\s*<p(?:\s[^>]*)?>")
_P_OPEN = re.compile(r"^<p(?:\s[^>]*)?>")
_P_CLOSE = re.compile(r"</p>$")

@register.filter
def inline_richtext(value):
    source = getattr(value, "source", value) or ""
    html = expand_db_html(str(source)).strip()
    html = _P_BETWEEN.sub("<br><br>", html)
    html = _P_OPEN.sub("", html)
    html = _P_CLOSE.sub("", html)
    return mark_safe(html)

        