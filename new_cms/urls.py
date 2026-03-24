from django.urls import path
from . import views

app_name = 'new_cms'

urlpatterns = [
    path('', views.index, name='index'),
    path('page/<int:page_id>', views.page_edit, name='page_edit')
    # I'll add more later
]
