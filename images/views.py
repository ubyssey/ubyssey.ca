from django.shortcuts import render
from wagtail.admin.models import popular_tags_for_model
from wagtail.images.views.chooser import ImageCreationFormMixin, BaseImageChooseView, ImageChooserViewSet, ImageChooseViewMixin
from wagtail.images import get_image_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count
from taggit.models import Tag
# Create your views here.

def get_all_tags_for_model(model, count=10):
    """Return a queryset of the most frequently used tags used on this model class"""
    content_type = ContentType.objects.get_for_model(model)
    return (
        Tag.objects.filter(taggit_taggeditem_items__content_type=content_type)
        .annotate(item_count=Count("taggit_taggeditem_items"))
        .order_by("-item_count")[:count]
    )

class UbysseyImageChooseViewMixin(ImageChooseViewMixin):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["popular_tags"] = popular_tags_for_model(self.model, count=100)
        return context

class UbysseyImageChooseView(
    UbysseyImageChooseViewMixin, ImageCreationFormMixin, BaseImageChooseView
):
    pass

class UbysseyImageViewSet(ImageChooserViewSet):
    choose_view_class = UbysseyImageChooseView

ubyssey_image_viewset = UbysseyImageViewSet(
    "wagtailimages_chooser",
    model=get_image_model(),
    url_prefix="images/chooser",
)