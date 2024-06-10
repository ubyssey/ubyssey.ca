from django.shortcuts import render
from taggit.models import Tag

class TagPage(object):
    def tag(self, request, slug):
        if Tag.objects.filter(slug=slug).exists():
            tag = Tag.objects.get(slug=slug)

            context = {
                "filters": {"tag": tag.slug},
                "self": {"title": "Tag - " + tag.name,
                         "slug": tag.slug},
            }
            return render(request, 'tag/tag_page.html', context)
        else:
            return render(request, '404.html', {}, status=404)