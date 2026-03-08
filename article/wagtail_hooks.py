from django.urls import path

from wagtail import hooks
from wagtail.admin.menu import MenuItem

from article.views import (
    tiptap_article_list_view,
    tiptap_admin_editor_view,
    tiptap_create_page,
    save_tiptap_page,
    publish_tiptap_page,
)


@hooks.register('register_admin_urls')
def register_tiptap_admin_urls():
    return [
        path('tiptap-editor/', tiptap_article_list_view, name='tiptap-article-list'),
        path('tiptap-editor/new/', tiptap_admin_editor_view, name='tiptap-editor-new'),
        path('tiptap-editor/<int:page_id>/', tiptap_admin_editor_view, name='tiptap-editor'),
        path('tiptap-editor/api/create/', tiptap_create_page, name='tiptap-page-create'),
        path('tiptap-editor/api/<int:page_id>/save/', save_tiptap_page, name='tiptap-page-save'),
        path('tiptap-editor/api/<int:page_id>/publish/', publish_tiptap_page, name='tiptap-page-publish'),
    ]


@hooks.register('register_admin_menu_item')
def register_tiptap_menu_item():
    return MenuItem(
        'TipTap Articles',
        '/admin/tiptap-editor/',
        icon_name='doc-full-inverse',
        order=300,
    )
