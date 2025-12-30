from django.db import models
from django.forms import Media

from wagtail.fields import StreamField
from wagtail import blocks
from wagtail.admin.panels import FieldPanel
from wagtail.admin.panels.model_utils import extract_panel_definitions_from_model_class
from wagtail.admin.panels import ObjectList
from wagtail.admin.staticfiles import versioned_static

from authors.models import AuthorPage
from article.models import ArticlePage

# Create your models here.

class LiveBlogMessage(models.Model):
    author_alias = models.CharField(max_length=250)
    author = models.ForeignKey(AuthorPage, on_delete=models.PROTECT)

    publish_date = models.DateTimeField(auto_created=True)

    content = StreamField(
        [
            ('richtext', blocks.RichTextBlock(                                
                label="Rich Text Block",
                help_text = "Write your liveblog message contents here. See documentation: https://docs.wagtail.io/en/latest/editor_manual/new_pages/creating_body_content.html#rich-text-fields"
            )),
        ], use_json_field=True)
    
    room_name = models.CharField(max_length=250)

    panels = [
        FieldPanel("author_alias"),
        FieldPanel("author"),
        FieldPanel("content"),
        FieldPanel("room_name", read_only=True),
    ]

class LiveBlogArticlePage(ArticlePage):
    template = "liveblog/basic_liveblog.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        
        #form_class = get_form_for_model(LiveBlogMessage)

        event = LiveBlogMessage(room_name=self.id)
        #form = form_class(instance=event)

        panels = extract_panel_definitions_from_model_class(LiveBlogMessage)
        print(panels)
        panel = ObjectList(panels).bind_to_model(LiveBlogMessage)
        form = panel.get_form_class()(instance=event)
        context['panel'] = panel.get_bound_panel(
            instance=event,
            form=form,
            request=request,
        )

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
                    versioned_static("wagtailadmin/css/panels/streamfield.css"),
                    versioned_static("wagtailadmin/css/panels/draftail.css")
                ]
            },
        )

        context['media'] = media

        return context