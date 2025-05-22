from django.shortcuts import render, redirect
from taggit.models import Tag
from wagtail.models import Site

def redirect_tag_to_topic(request, slug):
    return redirect("/topic/" + slug + "/")

def redirect_tag_feed_to_topic(request, slug):
    return redirect("/topic/" + slug + "/rss/")

class TagPage(object):
    def tag(self, request, slug):
        if Tag.objects.filter(slug=slug).exists():
            tag = Tag.objects.get(slug=slug)
            site =  Site.find_for_request(request)
            context = {
                "storystream": "true",
                "filters": {"tag": tag.slug},
                "meta": {"title": tag.name,
                         "slug": tag.slug,
                         "url": site.root_url + "/topic/" + tag.slug + "/",
                         "description": "Stories tagged '" + tag.name + "' from The Ubyssey."},
            }
            return render(request, 'tag/tag_page.html', context)
        else:
            return render(request, '404.html', {}, status=404)