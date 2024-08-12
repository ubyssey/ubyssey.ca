from django import template
import requests
from urllib.parse import urlparse
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter(name='get_link_icon')
def get_link_icon(url):
    domain = urlparse(url).netloc    
    domainToIcon = {'www.tumblr.com': 'logo-tumblr',
                    'www.instagram.com': 'logo-instagram',
                    'twitter.com': 'logo-twitter',
                    'www.facebook.com': 'logo-facebook',
                    'www.youtube.com': 'logo-youtube-play',
                    'www.tiktok.com': 'logo-tiktok',
                    'www.linkedin.com': 'logo-linkedin',
                    'www.reddit.com': 'logo-reddit'}
    extra = ""
    if domain in domainToIcon:
        icon = domainToIcon[domain]
        username = url.split("/")[-1]
        username = username.replace("@","")
    else:
        icon = "globe"
        try:
            json = requests.get(urlparse(url).scheme + "://" + domain + "/api/v2/instance").json()
            if 'source_url' in json:
                if json['source_url']=='https://github.com/mastodon/mastodon':
                    icon = "fa-mastodon"    
                    extra = "rel='me'"
                    username = url.split("/")[-1]
                    username = username.replace("@","")
        except:
             icon = "globe"
             username = domain
    
    return mark_safe('<a ' + extra + 'class="social_media_links" href="'+url+'"><ion-icon name="' + icon + '" style="font-size:1em;"></ion-icon>&nbsp;'+username+'</a>')
