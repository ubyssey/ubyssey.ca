from asgiref.sync import async_to_sync
import json

from django.db import models
from django.forms import Media, HiddenInput
from django.urls import reverse
from django.template import loader
from django.shortcuts import render
from django.utils import timezone
from django.forms.widgets import Select

from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel

from wagtail.fields import StreamField
from wagtail import blocks
from wagtail.admin.panels import (
    # Panels
    FieldPanel,
    FieldRowPanel,
    HelpPanel,
    InlinePanel,
    MultiFieldPanel,
    # Custom admin tabs
    ObjectList,
    TabbedInterface,
    TitleFieldPanel
)
from wagtail.admin.panels.model_utils import extract_panel_definitions_from_model_class
from wagtail.admin.panels import ObjectList, Panel
from wagtail.admin.staticfiles import versioned_static
from wagtail.admin.viewsets.model import ModelViewSet
from wagtail.snippets.models import register_snippet
from wagtail.contrib.routable_page.models import route, RoutablePageMixin
from wagtail.models import Orderable, Page

from wagtailcache.cache import clear_cache

from authors.models import AuthorPage
from article.models import ArticlePage
from article import blocks_inner_article as blocks_inner_article
from images.blocks import CaptionedImageBlock
from home.blocks import StorystreamItem

from liveblog.blocks import LiveblogHeader, LiveblogSummary, LiveblogRawHTML

from channels.layers import get_channel_layer

# Create your models here.

# We could use this so that authors are easy to query
#class LiveBlogUpdateAuthorsOrderable(Orderable):
#    """
#    This closely corresponds to the Dispatch model that is (mis-)named "Author"
#    """
#    liveblog_update = ParentalKey(
#        "liveblog.LiveBlogUpdate",
#        related_name="update_authors",
#    )
#    author = models.ForeignKey(AuthorPage, on_delete=models.PROTECT, related_name="authored_liveblog_updates")

class LiveBlogUpdateAuthorBlock(blocks.StructBlock):
    author = blocks.PageChooserBlock("authors.AuthorPage")
    author_role = blocks.CharBlock(required=False, max_length=250)

    def jsonFormat(self, value):
        value = self.to_python(value)
        author_image_template = "liveblog/objects/liveblog_update_author-image.html"
        author_image = None
        if value['author'].image:
            author_image = loader.render_to_string(author_image_template, {"author": value['author']})
        return {
            "author_image": author_image,
            "author_link": value['author'].full_url,
            "author_name": value['author'].full_name,
            "author_role": value['author_role'],
        }

@register_snippet
class LiveBlogUpdate(ClusterableModel):
    publish_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="You can leave this blank (it will auto populate). It's only necessary for changing the order of the blocks"
    )

    authors = StreamField(
        [
            ('author', LiveBlogUpdateAuthorBlock())
        ], 
        use_json_field=True,
        blank=True,
        null=True,
        min_num = 1,
    )

    content = StreamField(
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your liveblog message contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
            ('raw_html', blocks.RawHTMLBlock(
                label = "Raw HTML Block",
                help_text = "WARNING: DO NOT use this unless you really know what you're doing!"
            )),
            ('quote', blocks_inner_article.PullQuoteBlock()),
            ('image', CaptionedImageBlock()),
            ('storystream_item', StorystreamItem()),
        ], use_json_field=True)
    
    room_name = models.CharField(max_length=250)

    panels = [
        FieldPanel("authors"),
        FieldPanel("content"),
        MultiFieldPanel(
            [
                FieldPanel("publish_date"),
                FieldPanel("room_name", widget=HiddenInput)],
            heading="Advanced Fields",
            classname="collapsible collapsed",
        )
        
    ]

    def getParentLiveBlogPage(self):
        return Page.objects.filter(id=int(self.room_name)).first()
    
    def clearParentLiveBlogPageCache(self):
        def match_exact_url(url):
            """Return a regular expression that exactly matches the provided URL."""
            return '%s$' % url
    
        parent = self.getParentLiveBlogPage()
        if parent:          
            clear_cache([match_exact_url(parent.full_url)])

    def save(self, *args, **kwargs):
        if (self.publish_date == None):
            self.publish_date = timezone.now()

        save = super().save(*args, **kwargs)

        if self.room_name:
            channel_layer = get_channel_layer()

            async_to_sync(channel_layer.group_send)(
                f"liveblog_{self.room_name}", {
                    "type": "liveblog.message",
                    "message": json.dumps(self.jsonFormat()),
                }
            )
            
            self.clearParentLiveBlogPageCache()

        return save

    def delete(self, *args, **kwargs):

        if self.room_name:
            channel_layer = get_channel_layer()

            async_to_sync(channel_layer.group_send)(
                f"liveblog_{self.room_name}", {
                    "type": "liveblog.delete",
                    "id": self.id,
                }
            )

        delete = super().delete(*args, **kwargs)

        self.clearParentLiveBlogPageCache()

        return delete
    
    def jsonFormat(self):
        content_template = "liveblog/objects/liveblog-update-content.html"
        return {
            "id": self.id,
            "publish_date": self.publish_date.isoformat(),
            "authors": [author.block.jsonFormat(author.get_prep_value()["value"]) for author in self.authors],
            "html": loader.render_to_string(content_template, {"update": self}),
        }
 
class LiveBlogArticlePage(ArticlePage):
    template = "liveblog/liveblog_page.html"

    stage = StreamField([
            ("header", LiveblogHeader()),
            ("summary", LiveblogSummary()),
            ("raw_html", LiveblogRawHTML())
        ],
        default=[{"type": "header", "value":{}}],
        use_json_field=True,
    )

    layout = models.CharField(
        null=False,
        blank=False,
        default='default',
        verbose_name='Article Layout',
        max_length=100,
    )

    live_policy = models.CharField(
        null=False,
        blank=False,
        default='auto-30m',
        help_text='Determines when the article is considered "Live".',
        verbose_name='Live policy',
        max_length=100,
    )

    content_panels = [
            HelpPanel(template="liveblog/objects/liveblog-nav-link.html"),
            FieldPanel("stage"),
            FieldPanel(
                    "layout",
                    widget=Select(
                        choices=[
                            ('default', 'Default'),
                            ('split_view', 'Split view'),
                        ],
                    ),
                ),
            FieldPanel(
                    "live_policy",
                    widget=Select(
                        choices=[
                            ('manual-live', 'Live'),
                            ('manual-not-live', 'Not live'),
                            ('auto-30m', 'Auto (Live within 30 minutes of an update)'),
                        ],
                    ),
                ),
        ] + ArticlePage.content_panels

    edit_handler = TabbedInterface(
        [
            ObjectList(content_panels, heading='Content'),
            ObjectList(ArticlePage.promote_panels, heading='Promote'),
            ObjectList(ArticlePage.settings_panels, heading='Settings'),
            ObjectList(ArticlePage.customization_panels, heading='Special article stuff'),
        ],
    )

    def save(self, *args, **kwargs):
        save = super().save(*args, **kwargs)

        channel_layer = get_channel_layer()

        async_to_sync(channel_layer.group_send)(
            f"liveblog_{self.id}", {
                "type": "liveblog.page_update",
                "page": json.dumps(self.get_page_info()),
            }
        )

        return save

    def get_nav_html(self, request):
        return loader.render_to_string("article/objects/article-navigation.html", {"self": self, "section": self.current_section, "request": request})
    
    def get_suggested_html(self, request):
        return loader.render_to_string("article/objects/suggested_articles.html", {"suggested": self.get_suggested(), "request": request})

    def get_page_meta(self):
        return {
            "title": self.title,
            "lede": self.lede,
            "authors": self.get_authors_with_urls(),
            "layout": self.layout,
            "live_policy": self.live_policy,
        }

    def get_stage(self):
        return [{"type": child.block_type, "value": child.block.stageValue(child.get_prep_value()["value"])} for child in self.stage]

    def get_page_info(self):
        return {
            "meta": self.get_page_meta(),
            "stage": self.get_stage(),
        }

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context['updates'] = LiveBlogUpdate.objects.filter(room_name=self.id).order_by("publish_date")
        context['update_order'] = "asc"
        context['admin_view'] = False
        context['nav_html'] = self.get_nav_html(request)
        context['suggested_html'] = self.get_suggested_html(request)
        return context
    
    def get_admin_context(self, request, *args, **kwargs):
        context = self.get_context(request, *args, **kwargs)

        event = LiveBlogUpdate(room_name=self.id)

        panels = extract_panel_definitions_from_model_class(LiveBlogUpdate)
        print(panels)
        panel = ObjectList(panels).bind_to_model(LiveBlogUpdate)
        form = panel.get_form_class()(instance=event)
        context['panel'] = panel.get_bound_panel(
            instance=event,
            form=form,
            request=request,
        )

        action_url = "/admin/snippets/liveblog/liveblogupdate/add/"
        context['action_url'] = action_url
        context['update_order'] = "desc"
        context['updates'] = context['updates'].order_by("-publish_date")

        context['admin_view'] = True

        #media = context['panel'].media
        # Is there a way of obtaining the static files we need through the panel? Couldn't figure it out. - Sam Low 2025/12/30
        media = Media(js=[
            versioned_static("wagtailadmin/js/date-time-chooser.js"),
            versioned_static("wagtailadmin/js/telepath/widgets.js"),
            versioned_static("wagtailadmin/js/draftail.js"),
            versioned_static("wagtailembeds/js/embed-chooser-modal.js"),
            versioned_static("wagtailadmin/js/page-chooser-modal.js"),
            versioned_static("wagtaildocs/js/document-chooser-modal.js"),
            versioned_static("wagtailimages/js/image-chooser-modal.js"),
            versioned_static("wagtailsnippets/js/snippet-chooser-telepath.js"),
            versioned_static("wagtailsnippets/js/snippet-chooser.js"),
            versioned_static("wagtail_color_panel/js/color-input-widget.js"),
            versioned_static("wagtailadmin/js/chooser-widget.js"),
            versioned_static("wagtailadmin/js/telepath/blocks.js"),
            versioned_static("wagtailimages/js/image-chooser-telepath.js"),
            versioned_static("wagtailimages/js/image-chooser.js"),
            versioned_static("wagtaildocs/js/document-chooser-telepath.js"),
            versioned_static("wagtaildocs/js/document-chooser.js"),
            versioned_static("wagtailadmin/js/page-chooser-telepath.js"),
            versioned_static("wagtailadmin/js/page-chooser.js"),
        ],
        css={
                "all": [
                    versioned_static("wagtailadmin/css/core.css"),
                    versioned_static("wagtailadmin/css/panels/streamfield.css"),
                    versioned_static("wagtailadmin/css/panels/draftail.css"),
                ]
            },
        )

        context['media'] = media

        return context
    
    def updated_at(self):
        time = LiveBlogUpdate.objects.filter(room_name=self.id).order_by("-publish_date").first()
        if time:
            return time.publish_date
        return None

    def is_live(self):
        updated = self.updated_at()
        if self.live_policy == 'auto-30m':
            if updated:
                return timezone.now() - updated < timezone.timedelta(minutes=30)
            return False
        
        return self.live_policy == 'manual-live'

    def updateJsonFormat(self):
        updates = LiveBlogUpdate.objects.filter(room_name=self.id).order_by("-publish_date")
        return [update.jsonFormat() for update in updates]