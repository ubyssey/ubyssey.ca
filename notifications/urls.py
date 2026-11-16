from django.urls import path, re_path
from django.urls import include
from . import views

#quick test to see if notifications are working, to be deleted later

urlpatterns =  [
    re_path(r'^webpush/', include('webpush.urls')),
    path("notify/", views.mockWebPush, name="notifcation"),
]