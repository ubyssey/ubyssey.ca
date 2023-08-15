from rest_framework import routers
from rest_framework.urlpatterns import format_suffix_patterns

from ubyssey.events.api import views

router = routers.DefaultRouter()

router.register(r"", views.EventViewSet, basename="api-event")

urlpatterns = router.urls
