from django.shortcuts import render
from wagtail.admin.models import popular_tags_for_model
from wagtail.images.views.chooser import ImageCreationFormMixin, BaseImageChooseView, ImageChooserViewSet, ImageChooseViewMixin
from wagtail.images import get_image_model
# Create your views here.

class UbysseyImageChooseViewMixin(ImageChooseViewMixin):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["popular_tags"] = popular_tags_for_model(self.model, count=50)
        return context

class UbysseyImageChooseView(
    UbysseyImageChooseViewMixin, ImageCreationFormMixin, BaseImageChooseView
):
    pass

class UbysseyImageViewSet(ImageChooserViewSet):
    per_page = 50
    choose_view_class = UbysseyImageChooseView

ubyssey_image_viewset = UbysseyImageViewSet(
    "wagtailimages_chooser",
    model=get_image_model(),
    url_prefix="images/chooser",
)