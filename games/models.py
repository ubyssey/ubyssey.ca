from django.db import models

from wagtail import blocks
from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail.admin.panels import FieldPanel
from wagtail.documents.blocks import DocumentChooserBlock

class GamesHome(Page):
    template = "games/home.html"

    max_count = 1
    parent_page_types = ["home.HomePage"]
    subpage_types = ["games.Crossword"]
    show_in_menus_default = True

# Currently using this format https://github.com/JaredReisinger/react-crossword
class Crossword(Page):

    template = "games/crossword.html"
    parent_page_types = ["games.GamesHome"]

    puzzle = StreamField([
        ("puzzle", DocumentChooserBlock())
    ], null=True, use_json_field=True,)

    content_panels = Page.content_panels + [
        FieldPanel('puzzle'),
    ]

    def get_context(self, request):
        context = super().get_context(request)

        for block in self.puzzle:
            if block.block_type == "puzzle" and block.value:
                with block.value.file.open('r') as file:
                    puzzle_json_string = file.read()
            break
        
        context["puzzle_data"] = puzzle_json_string
        return context