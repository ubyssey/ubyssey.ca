from django.shortcuts import render, redirect
from wagtail.models import Site
from article.models import ArticleTopic

def redirect_tag_to_topic(request, slug):
    return redirect("/topic/" + slug + "/")

def redirect_tag_feed_to_topic(request, slug):
    return redirect("/topic/" + slug + "/rss/")

class TagPage(object):
    def tag(self, request, slug):
        if ArticleTopic.objects.filter(slug=slug).exists():
            tag = ArticleTopic.objects.get(slug=slug)
            site =  Site.find_for_request(request)
            context = {
                "object": tag,
                "storystream": "true",
                "filters": {"tag": tag.id},
                "meta": {"title": tag.name,
                         "slug": tag.slug,
                         "url": site.root_url + "/topic/" + tag.slug + "/",
                         "description": "Stories tagged '" + tag.name + "' from The Ubyssey."},
            }
            return render(request, 'tag/tag_page.html', context)
        else:
            return render(request, '404.html', {}, status=404)