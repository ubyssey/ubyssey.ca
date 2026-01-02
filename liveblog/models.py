from asgiref.sync import async_to_sync

from django.db import models
from django.forms import Media, HiddenInput
from django.urls import reverse
from django.template import loader
from django.shortcuts import render

from wagtail.fields import StreamField
from wagtail import blocks
from wagtail.admin.panels import FieldPanel, FieldRowPanel
from wagtail.admin.panels.model_utils import extract_panel_definitions_from_model_class
from wagtail.admin.panels import ObjectList
from wagtail.admin.staticfiles import versioned_static
from wagtail.admin.viewsets.model import ModelViewSet
from wagtail.snippets.models import register_snippet
from wagtail.contrib.routable_page.models import route, RoutablePageMixin

from authors.models import AuthorPage
from article.models import ArticlePage

from channels.layers import get_channel_layer

# Create your models here.
@register_snippet
class LiveBlogUpdate(models.Model):
    author_alias = models.CharField(max_length=250, blank=True, null=True)
    author = models.ForeignKey(AuthorPage, on_delete=models.PROTECT)

    publish_date = models.DateTimeField(auto_now_add=True)

    content = StreamField(
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your liveblog message contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
        ], use_json_field=True)
    
    room_name = models.CharField(max_length=250)

    panels = [
        FieldRowPanel(
            [
                FieldPanel("author"),
                FieldPanel("author_alias"),
            ]
        ),
        FieldPanel("content"),
        FieldPanel("room_name", widget=HiddenInput),
    ]

    template = "liveblog/objects/liveblog-update.html"

    def save(self, force_insert = None, force_update = None, using = None, update_fields = None):
        save = super().save(force_insert, force_update, using, update_fields)
        if self.room_name:
            channel_layer = get_channel_layer()

            html = loader.render_to_string(self.template, {"update": self})

            async_to_sync(channel_layer.group_send)(
                f"liveblog_{self.room_name}", {"type": "liveblog.message", "message": html}
            )

        return save
 
class LiveBlogArticlePage(ArticlePage):
    template = "liveblog/liveblog_page.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context['updates'] = LiveBlogUpdate.objects.filter(room_name=self.id).order_by("publish_date")
        context['update_order'] = "asc"
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

        #media = context['panel'].media
        # Is there a way of obtaining the static files we need through the panel? Couldn't figure it out. - Sam Low 2025/12/30
        media = Media(js=[
            versioned_static("wagtailadmin/js/date-time-chooser.js"),
            versioned_static("wagtailadmin/js/telepath/telepath.js"),
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
            versioned_static("wagtailadmin/js/page-chooser.js"),
            versioned_static("wagtaildocs/js/document-chooser.js"),
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

    @route(r'^admin/$', name='admin_view')
    def admin_view(self, request):
        return render(request, "liveblog/liveblog_admin_page.html", self.get_admin_context(request))