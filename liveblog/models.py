from django.db import models

from wagtail.fields import StreamField
from wagtail import blocks

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

class LiveBlogArticlePage(ArticlePage):
    template = "liveblog/basic_liveblog.html"