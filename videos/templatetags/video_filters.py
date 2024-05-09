"""
In Django, filters are customized template tags. See below documentation.

https://docs.djangoproject.com/en/dev/howto/custom-template-tags/

These tags are necessary because only particular youtube URLs can be embedded into a third party website in such a way as to be actually playable.
See this blog:

https://danielms.site/blog/wagtail-embedurl-youtube-tags/
"""
from django import template
register = template.Library()
import re as regex

YOUTUBE_REGEX_STRING = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})'

@register.filter(name='youtube_embed_id')
def youtube_embed_id(url):
    youtube_regex = regex.compile(YOUTUBE_REGEX_STRING)
    match = youtube_regex.match(url)
    if not match:
        raise template.TemplateSyntaxError(
            "youtube_embed_id tag requires valid youtube URL as argument. url = %s" %url
        )
    return match.group('id')            

@register.filter(name='youtube_embed_url')
def youtube_embed_url(url):
    youtube_regex = regex.compile(YOUTUBE_REGEX_STRING)
    match = youtube_regex.match(url)
    if not match:
        raise template.TemplateSyntaxError(
            "youtube_embed_url tag requires valid youtube URL as argument. url = %s" %url
        )
    embed_url = 'https://www.youtube.com/embed/%s' %(match.group('id'))
    return embed_url
