# newsletter/urls.py

from django.urls import path
from . import views

app_name = 'newsletter'
urlpatterns = [
    # path('', views.Index.as_view(), name='index'),
    path('subscribe/', views.SubscriberCreateView.as_view(), name='subscribe'),
    path('success/', views.SuccessView.as_view(), name='success'),
]
