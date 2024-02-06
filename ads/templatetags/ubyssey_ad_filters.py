from requests import request
from ads.models import AdTagSettings
from bs4 import BeautifulSoup
from django import template
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from itertools import zip_longest
from random import randint

register = template.Library()

MAX_ADS = 5 # based on the max number of "Intra_Article_X" slots available in Google Ad Manager
PARAGRAPHS_PER_AD = 6

@register.filter(name='inject_ads')
@stringfilter
def inject_ads(value, is_mobile):
    # Inspired by https://timonweb.com/django/creating-custom-template-filter-that-injects-adsense-ad-code-after-n-paragraph-in-django/ but heavily modified
    
    if not isinstance(is_mobile,bool):
        # If something goes wrong in detecting whether the user is on mobile or not, sensible failsafe is to assume they ARE
        # Doing so will cause the ads displayed to appear as "box" rather than "banner" size. Both work fine on desktop. Only box works well on mobile.
        is_mobile = True

    # Break down content into paragraphs
    soup = BeautifulSoup(value, 'html.parser')
    paragraphs = soup.select(".article-content > p")

    if PARAGRAPHS_PER_AD < len(paragraphs): # If the article is somehow too short for even one ad, it doesn't get any
        x = range(0, len(paragraphs), PARAGRAPHS_PER_AD)
        for n in x:
            if n > 0: # Don't put an ad at the very beginning of the article                
                if (n // PARAGRAPHS_PER_AD) > MAX_ADS: # if we're above the max number of ads per article, stop!
                    break

                dfp = 'Intra_Article_' + str((n // PARAGRAPHS_PER_AD))
                div_id = dfp
                if is_mobile:
                    size = 'mobile-leaderboard'
                else:
                    size = 'banner'

                ad_context = {
                    'div_id' : div_id,
                    'dfp' : dfp,
                    'size' : size,
                }
                ad_string = render_to_string('ads/advertisement_inline.html', context=ad_context)
                paragraphs[n].insert_after(BeautifulSoup(ad_string, 'html.parser'))

    return soup

@register.filter(name='specify_homepage_sidebar_ads')
@stringfilter
def specify_homepage_sidebar_ads(value, request):
    """
        Searches the homepage for ads with class 'sidebar-block--advertisement' and inserts necessary code for google ad manager to place an ad there

        (NTS 2022/07/08: Magic string is unfortunate and maybe should be fixed)
    """

    # Find all the divs that will contain sidebar ads on the page
    soup = BeautifulSoup(value, 'html5lib')
    adslot_divs = soup.find_all("div", {"class": "sidebar-block--advertisement"})

    # Get all the ads to place in the aforementioned divs
    ad_settings = AdTagSettings.for_request(request)
    sidebar_ads = list(ad_settings.home_sidebar_placements.all())

    # Zip the divs together with their corresponding ad
    zipped_placements_and_contents = zip_longest(adslot_divs, sidebar_ads)

    # Insert the ad into the divs using Beautiful Soup
    for (div, orderable) in list(zipped_placements_and_contents):
        if orderable:
            ad_context = {
                'div_id' : orderable.ad_slot.div_id,
                'dfp' : orderable.ad_slot.dfp,
                'size' : orderable.ad_slot.size,
                'div_class' : orderable.ad_slot.div_class,
            }
        else:
            ad_context = {
                'div_id' : 'ad-tag-error',
                'dfp' : 'ad-tag-error',
                'size' : 'ad-tag-error',
                'div_class' : '',
            }
        if div:
            new_tag_soup = BeautifulSoup(render_to_string('ads/gpt_placement_tag.html',context=ad_context), 'html5lib')
            div.clear()
            div.append(new_tag_soup.div)
    return soup