from .models import AdSlot
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

class MySnippetViewSet(SnippetViewSet):
    model = AdSlot
    menu_label = 'Register Ad Slots'
    icon = 'cogs'
    menu_order = 1000
    add_to_settings_menu = True
    list_display = ('slug', 'dfp', 'size','div_id','div_class')
register_snippet(MySnippetViewSet)