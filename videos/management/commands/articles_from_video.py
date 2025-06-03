from django.core.management.base import BaseCommand

from wagtail.models import Site

from article.models import ArticleAuthorsOrderable, ArticleFeaturedMediaOrderable, ArticlePage
from section.models import SectionPage
from videos.models import VideoSnippet

class Command(BaseCommand): 
    help = 'Migrates the categories snippet model to section page'
    def handle(self, *args, **kwargs):
        if not SectionPage.objects.filter(slug="video").exists():
            video_section = SectionPage(title="Video", slug="video")
            print(Site.objects.all()[0].root_page)
            Site.objects.all()[0].root_page.add_child(instance=video_section)
        else:
            video_section = SectionPage.objects.get(slug="video")
        for video in VideoSnippet.objects.all():
            print(video.title)
            if ArticlePage.get_descendants(video_section).filter(slug=video.slug).exists():
                continue
            video_article = ArticlePage(
                                title=video.title,
                                slug=video.slug,
                                first_published_at=video.created_at,
                                explicit_published_at=video.created_at,
                                header_layout="video-banner",
                                storystream_view = [{"type": "featured_video", "value": {"template": "featured"}}]
                                )

            video_section.add_child(instance=video_article)

            ArticleFeaturedMediaOrderable.objects.create(article_page=video_article, sort_order=0, video=video.url)

            for video_author in video.video_authors.all():
                print(video_author.author.title)
                ArticleAuthorsOrderable.objects.create(
                    author_id=video_author.author_id,\
                    sort_order=video_author.sort_order, \
                    article_page_id=video_article.id, \
                    author_role="videographer"
                    )