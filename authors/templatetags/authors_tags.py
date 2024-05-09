from django import template
import requests
from urllib.parse import urlparse
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter(name='get_link_icon')
def get_link_icon(url):
    domain = urlparse(url).netloc    
    domainToIcon = {'www.tumblr.com': 'fa-tumblr',
                    'www.instagram.com': 'fa-instagram',
                    'twitter.com': 'fa-twitter',
                    'www.facebook.com': 'fa-facebook',
                    'www.youtube.com': 'fa-youtube-play',
                    'www.tiktok.com': 'fa-tiktok',
                    'www.linkedin.com': 'fa-linkedin',
                    'www.reddit.com': 'fa-reddit'}
    extra = ""
    if domain in domainToIcon:
        icon = domainToIcon[domain]
        username = url.split("/")[-1]
        username = username.replace("@","")
    else:
        icon = "fa-globe"
        try:
            json = requests.get(urlparse(url).scheme + "://" + domain + "/api/v2/instance").json()
            if 'source_url' in json:
                if json['source_url']=='https://github.com/mastodon/mastodon':
                    icon = "fa-mastodon"    
                    extra = "rel='me'"
                    username = url.split("/")[-1]
                    username = username.replace("@","")
        except:
             icon = "fa-globe"
             username = domain
    
    return mark_safe('<a ' + extra + 'class="social_media_links" href="'+url+'"><i class="fa ' + icon + ' fa-fw" style="font-size:1em;"></i>&nbsp;'+username+'</a>')
