from django.db import models

from wagtail import blocks
from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail.admin.panels import FieldPanel
from wagtail.documents.blocks import DocumentChooserBlock
from django.core.exceptions import ValidationError
from django.http import Http404

class GamesHome(Page):
    template = "games/home.html"

    max_count = 1
    parent_page_types = ["home.HomePage"]
    #subpage_types = ["games.Crossword"]
    subpage_types=["games.GameCategoryPage"]
    show_in_menus_default = True

    def get_context(self, request):

        context = super().get_context(request)
        
        all_puzzles = Crossword.objects.descendant_of(self).live().public()
        
        context['crossword_puzzles'] = all_puzzles

        return context

class CrosswordFileChooserBlock(DocumentChooserBlock):
    def clean(self, value):
        result = super().clean(value)

        if result and not result.file.name.lower().endswith('.ipuz'):
            raise ValidationError("Please choose a valid '.ipuz' file")
        return result

class GameCategoryPage(Page):

    def serve(self, request, *args, **kwargs):
        raise Http404("This page is a category page")

    subpage_types=["games.Crossword"]

    parent_page_types= ["games.GamesHome"]

    show_in_menus_default = True


# Currently using this format https://github.com/JaredReisinger/react-crossword
class Crossword(Page):

    # Some of this can be abstracted into a base game class but this is ok for now

    template = "games/crossword.html"
    parent_page_types = ["games.GameCategoryPage"]

    puzzle = StreamField([
        ("puzzle", CrosswordFileChooserBlock())
    ], null=True, use_json_field=True,)

    content_panels = Page.content_panels + [
        FieldPanel('puzzle'),
    ]

    def get_games_home(self):
        return self.get_ancestors().type(GamesHome).first()

    def get_context(self, request):
        context = super().get_context(request)

        for block in self.puzzle:
            if block.block_type == "puzzle" and block.value:
                with block.value.file.open('r') as file:
                    puzzle_json_string = file.read()
            break
        
        context["puzzle_data"] = puzzle_json_string

        return context