from django.urls import re_path

from ubyssey.events import views

urlpatterns = [
    re_path(r'^$', views.events, name='events'),
    re_path(r'^submit/form/', views.submit_form, name='events-submit-form'),
    re_path(r'^submit/success/', views.submit_success, name='events-submit-success'),
    re_path(r'^submit/$', views.submit_landing, name='events-submit-landing'),
    re_path(r'^edit/success/', views.edit_success, name='events-edit-success'),
    re_path(r'^edit/(?P<secret_id>.+)', views.edit, name='events-edit'),
    re_path(r'^import/', views.event_import, name='events-import'),
    re_path(r'^(?P<event_id>.+)/$', views.event, name='event'),
]
