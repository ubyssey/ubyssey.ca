import json
from random import randint

from dispatch.models import Article, Tag
from django.db.models import F
from django.http import Http404, HttpResponse
from django.shortcuts import render
from django.template import loader
from django.templatetags.static import static
from django.urls import reverse
from django.views.generic import ListView
from django.views.generic.base import TemplateView
from django.views.generic.detail import DetailView
from django_user_agents.utils import get_user_agent

import ubyssey
from ubyssey.helpers import ArticleHelper
from ubyssey.mixins import ArticleMixin, DispatchPublishableViewMixin


class MagazineArticleView(DispatchPublishableViewMixin, ArticleMixin, DetailView):
    SITE_TITLE = "The Ubyssey Magazine"
    model = Article

    def setup(self, request, *args, **kwargs):
        return super().setup(request, *args, **kwargs)

    def get_template_names(self):
        """
        Lazily stolen from ArticleView in main.py
        Returns a LIST of strings that represent template files (almost always HTML)

        Because this is called during render_to_response(), but also appears earlier than get_queryset in the DetailView flowchart,
        we use an if conditional to confirm whether the Article object has been queried and set
        """
        # This should be imitating and expanding upon the functionality that was here before:
        #        t = loader.select_template(['%s/%s' % (article.section.slug, article.get_template_path()), article.get_template_path()])
        template_names = []
        if self.object:
            object_section_slug = str(self.object.section.slug)
            object_template = str(self.object.get_template_path())
            template_names += [
                "%s/%s" % (object_section_slug, object_template),
                object_template,
                "article/default.html",
            ]
        template_names += super().get_template_names()
        return template_names

    def get_context_data(self, **kwargs):
        # init context with super()
        context = super().get_context_data(**kwargs)

        # specific values for context
        context["title"] = "%s - %s" % (self.object.headline, self.SITE_TITLE)
        # context['meta'] = self.object.get_meta(self.object, default_image=static('ubyssey/images/magazine/2017/cover-social.png')),
        context["article"] = self.object
        subsection = (
            self.object.subsection.name.lower() if self.object.subsection else ""
        )
        context["subsection"] = "subsection"
        context["specific_css"] = "ubyssey/css/magazine-" + str(self.year) + ".css"
        context["year"] = self.year
        context["suggested"] = ArticleHelper.get_random_articles(
            2, "magazine", exclude=self.object.id
        )
        context["base_template"] = "magazine/base.html"
        context["magazine_title"] = self.title
        return context


class MagazineLandingView(ListView):
    model = Article

    def setup(self, request, *args, **kwargs):
        # Parent class version
        self.year = kwargs["year"] if kwargs["year"] is not None else 2021
        return super().setup(request, *args, **kwargs)

    def get_template_names(self):
        template_name = (
            "magazine/" + self.year + "/landing.html"
        )  # self.year should have defaulted to 2021
        template_names = [template_name]
        template_names += super().get_template_names()
        return template_names

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(is_published=True, section__slug="magazine", tags__name=self.year)
            .order_by("-importance")
        )

    def get_context_data(self, **kwargs):
        # init context with super()
        context = super().get_context_data(**kwargs)
        return context


class MagazineTheme(object):
    def __init__(self):
        self.mags = {}

    def add_magazine(self, magazine):
        self.mags[magazine.year] = magazine

    def landing(self, request):
        # homepage for all magazines
        pass

    def magazine(self, request, year=None):
        """Landing page for a specific magazine year."""
        if year in self.mags:
            return self.mags[year].landing(request)

        raise Http404("Page cannot be found")

    def article(self, request, slug=None):
        # TODO: tidy these remaining views up
        try:
            article = Article.objects.filter(slug=slug, is_published=True).first()
        except:
            raise Http404("Article could not be found. Keegan wuz here")

        year = article.tags.get(name__icontains="20").name

        if year in self.mags:
            return self.mags[year].article(request, article)

        raise Http404("Magazine for the year %d does not exist." % year)


class Magazine(object):
    SITE_TITLE = "The Ubyssey Magazine"

    def __init__(self, year, title):
        self.year = str(year)
        self.title = title

    def article(self, request, article):
        """Magazine article page view."""

        print(self.year)

        subsection = article.subsection.name.lower() if article.subsection else ""

        # determine if user is viewing from mobile
        # Also handled by ArticleView in get context. Thus we can and should remove it
        article_type = "desktop"
        user_agent = get_user_agent(request)
        if user_agent.is_mobile:
            article_type = "mobile"

        if not ArticleHelper.is_explicit(article):
            article.content = ArticleHelper.insert_ads(article.content, article_type)

        # TODO: Fix hardcoding on default_image; no good available default
        context = {
            "title": "%s - %s"
            % (article.headline, self.SITE_TITLE),  # normal stuff, replicated just fine
            "meta": ArticleHelper.get_meta(
                article,
                default_image=static("ubyssey/images/magazine/2017/cover-social.png"),
            ),
            "article": article,
            "subsection": subsection,
            "specific_css": "ubyssey/css/magazine-" + self.year + ".css",
            "year": self.year,
            "suggested": ArticleHelper.get_random_articles(
                2, "magazine", tag_name=self.year, exclude=article.id
            ),  # lazy use of the helper still; get rid of this eventually
            "base_template": "magazine/base.html",
            "magazine_title": self.title,
        }

        t = loader.select_template(
            [
                "%s/%s" % (article.section.slug, article.get_template_path()),
                article.get_template_path(),
            ]
        )

        return HttpResponse(t.render(context))


class MagazineV1(Magazine):
    """View type 1 for The Ubyssey Magazine 2017 2018 microsite."""

    def __init__(self, year, title, description, get_cover, social_cover, template):
        super().__init__(year, title)

        self.description = description
        self.get_cover = get_cover
        self.social_cover = social_cover
        self.template = template

    def landing(self, request, year=None):
        """Archive landing page."""

        articles = Article.objects.filter(
            is_published=True, section__slug="magazine", tags__name=self.year
        ).order_by("-importance")

        context = {
            "meta": {
                "title": self.title,
                "description": self.description,
                "url": reverse("magazine-landing", kwargs={"year": self.year}),
                "image": static(self.social_cover),
            },
            "cover": self.get_cover,
            "articles": articles,
            "year": self.year,
        }

        return render(request, self.template, context)


class MagazineV2(Magazine):
    """View type 2 for The Ubyssey Magazine 2019 2020 microsite."""

    def __init__(
        self,
        year,
        title,
        description,
        get_cover,
        template,
        section1_img,
        section2_img,
        section3_img,
        section1_name,
        section2_name,
        section3_name,
    ):
        super().__init__(year, title)

        self.description = description
        self.get_cover = get_cover
        self.template = template
        self.section1_name = section1_name
        self.section2_name = section2_name
        self.section3_name = section3_name
        self.section1_img = section1_img
        self.section2_img = section2_img
        self.section3_img = section3_img

    def landing(self, request, year=None):
        """Magazine landing page view."""
        # Get all 2019 magazine articles
        articles = (
            Article.objects.select_related("section", "subsection")
            .filter(is_published=True, section__slug="magazine", tags__name=self.year)
            .order_by("-importance")
        )
        section1 = []
        section2 = []
        section3 = []

        for article in articles:
            featuredImage = (
                article.featured_image.image.get_medium_url()
                if article.featured_image is not None
                else None
            )
            color = (
                article.template_fields["color"]
                if "color" in article.template_fields
                else None
            )

            temp = {
                "headline": article.headline,
                "url": article.get_absolute_url(),
                "featured_image": featuredImage,
                "color": color,
            }

            if article.subsection:
                if article.subsection.slug == self.section1_name:
                    section1.append(temp.copy())
                elif article.subsection.slug == self.section2_name:
                    section2.append(temp.copy())
                elif article.subsection.slug == self.section3_name:
                    section3.append(temp.copy())

        json_articles = json.dumps(
            {
                self.section1_name: section1,
                self.section2_name: section2,
                self.section3_name: section3,
            }
        )

        context = {
            "meta": {
                "title": self.title,
                "description": self.description,
                "url": reverse("magazine-landing", kwargs={"year": self.year}),
                "image": static(self.get_cover),
            },
            "cover": self.get_cover,
            "year": self.year,
            "section1Image": self.section1_img,
            "section2Image": self.section2_img,
            "section3Image": self.section3_img,
            "json_articles": json_articles,
        }
        return render(request, self.template, context)


magazine = MagazineTheme()

mag2017 = MagazineV1(
    2017,
    "The Ubyssey Magazine",
    "The Ubyssey's first magazine.",
    lambda: "ubyssey/images/magazine/2017/cover-%d.jpg" % randint(1, 2),
    "ubyssey/images/magazine/2017/cover-social.png",
    "magazine/2017/landing.html",
)

mag2018 = MagazineV1(
    2018,
    "The Ubyssey Magazine - How we live",
    "The February 2018 issue of the Ubyssey magazine.",
    "ubyssey/images/magazine/2018/cover.jpg",
    "ubyssey/images/magazine/2018/cover-social.jpg",
    "magazine/2018/landing.html",
)

mag2019 = MagazineV2(
    2019,
    "The Ubyssey Magazine - Presence",
    "The February 2019 issue of the Ubyssey magazine.",
    "ubyssey/images/magazine/2019/cover.gif",
    "magazine/2019/landing.html",
    "ubyssey/images/magazine/2019/subsection-reclaim.png",
    "ubyssey/images/magazine/2019/subsection-redefine.png",
    "ubyssey/images/magazine/2019/subsection-resolve.png",
    "reclaim",
    "redefine",
    "resolve",
)

mag2020 = MagazineV2(
    2020,
    "The Ubyssey Magazine - Hot Mess",
    "The February 2020 issue of the Ubyssey magazine.",
    "ubyssey/images/magazine/2020/cover.png",
    "magazine/2020/landing.html",
    "ubyssey/images/magazine/2020/section1.png",
    "ubyssey/images/magazine/2020/section2.png",
    "ubyssey/images/magazine/2020/section3.jpg",
    "goesAround",
    "comesAround",
    "waysForward",
)

mag2021 = MagazineV2(
    2021,
    "The Ubyssey Magazine - System Reboot Required",
    "The February 2021 issue of the Ubyssey magazine.",
    "ubyssey/images/magazine/2020/cover.png",
    "magazine/2021/landing.html",
    "ubyssey/images/magazine/2020/section1.png",
    "ubyssey/images/magazine/2020/section2.png",
    "ubyssey/images/magazine/2020/section3.jpg",
    "Memory-Leak",
    "Seg-Fault",
    "System-Failure",
)
magazine.add_magazine(mag2017)
magazine.add_magazine(mag2018)
magazine.add_magazine(mag2019)
magazine.add_magazine(mag2020)
magazine.add_magazine(mag2021)
