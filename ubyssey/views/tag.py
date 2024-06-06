from django.shortcuts import render

class TagPage(object):
    def tag(self, request, slug):
        context = {
            "filters": {"tag": slug},
            "self": {"title": "Tag - " + slug,
                     "pageurl": "/tag"},
        }
        context["self"].setdefault
        return render(request, 'tag/tag_page.html', context)