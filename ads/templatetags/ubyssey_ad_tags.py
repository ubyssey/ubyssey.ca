from django import template

from ..models import AdSlot

register = template.Library()


@register.inclusion_tag("ads/gpt_placement_tag.html")
def gpt_placement_tag(slug) -> dict:
    try:
        ad_slot = AdSlot.objects.get(slug=slug)
        return {
            "div_id": ad_slot.div_id,
            "dfp": ad_slot.dfp,
            "size": ad_slot.size,
            "div_class": ad_slot.div_class,
        }
    except:
        return {
            "div_id": "ad-tag-error",
            "dfp": "ad-tag-error",
            "size": "ad-tag-error",
            "div_class": "",
        }


@register.inclusion_tag("ads/gpt_define_tag.html")
def gpt_define_tag(slug, is_mobile=False) -> dict:
    try:
        ad_slot = AdSlot.objects.get(slug=slug)
        SIZES = {
            "box": "[300, 250]",
            "skyscraper": "[[300, 250], [300, 600]]",
            "banner": "[468, 60]",
            "leaderboard": "[[728, 90], [970, 90]]",
            "mobile-leaderboard": "[320, 50]",
        }
        if is_mobile and "Intra_Article" in ad_slot.dfp:
            return {
                "div_id": ad_slot.div_id,
                "dfp": ad_slot.dfp,
                "size": SIZES["mobile-leaderboard"],
            }
        else:
            return {
                "div_id": ad_slot.div_id,
                "dfp": ad_slot.dfp,
                "size": SIZES[ad_slot.size],
            }
    except:
        return {
            "div_id": "ad-tag-error",
            "dfp": "ad-tag-error",
            "size": "ad-tag-error",
        }
