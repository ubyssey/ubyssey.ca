from django.shortcuts import render
from taggit.models import Tag
from wagtail.models import Site

class TagPage(object):
    def tag(self, request, slug):
        if Tag.objects.filter(slug=slug).exists():
            tag = Tag.objects.get(slug=slug)
            site =  Site.find_for_request(request)
            context = {
                "filters": {"tag": tag.slug},
                "meta": {"title": tag.name,
                         "slug": tag.slug,
                         "url": site.root_url + "/tag/" + tag.slug + "/",
                         "description": "Tag page for stories tagged '" + tag.name + "' from The Ubyssey."},
            }
            return render(request, 'tag/tag_page.html', context)
        else:
            return render(request, '404.html', {}, status=404)