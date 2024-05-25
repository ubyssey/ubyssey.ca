from wagtail.admin.viewsets.chooser import ChooserViewSet
from .models import AuthorPage
from django.db.models import F
from wagtail.admin.views.generic.chooser import (
    BaseChooseView, ChooseViewMixin, CreationFormMixin
)
from wagtail.admin.ui.tables import Column, TitleColumn

class BaseAuthorPageChooseView(BaseChooseView):
    @property
    def columns(self):
        return [
            self.title_column,
            Column(
                "last_activity", label="Last Activity", accessor="last_activity"
            )
        ]

class AuthorPageChooseView(ChooseViewMixin, CreationFormMixin, BaseAuthorPageChooseView):
    pass

class AuthorPageViewSet(ChooserViewSet):
    model = AuthorPage
    per_page = 50
    choose_view_class = AuthorPageChooseView
    
    def get_queryset(self):
        return AuthorPage.objects

    def get_object_list(self):
        return AuthorPage.objects.order_by(F('last_activity').desc(nulls_last=True))
    

author_chooser_viewset = AuthorPageViewSet("author_chooser")