from django.db import models

from wagtail import blocks
from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail.admin.panels import FieldPanel

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
        (
            "across",
            blocks.ListBlock(
                blocks.StructBlock([
                    ('clue', blocks.CharBlock()),
                    ('answer', blocks.CharBlock()),
                    ('row', blocks.IntegerBlock()),
                    ('column', blocks.IntegerBlock()),
                ])
            )
        ),
        (
            "down",
            blocks.ListBlock(
                blocks.StructBlock([
                    ('clue', blocks.CharBlock()),
                    ('answer', blocks.CharBlock()),
                    ('row', blocks.IntegerBlock()),
                    ('column', blocks.IntegerBlock()),
                ])
            )
        ),
    ], null=True)

    content_panels = Page.content_panels + [
        FieldPanel('puzzle'),
    ]
