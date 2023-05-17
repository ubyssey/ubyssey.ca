from django.db import models
from django_extensions.db.fields import AutoSlugField
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from ubyssey.validators import validate_colour_hex
from wagtail.admin.edit_handlers import FieldPanel, InlinePanel, MultiFieldPanel
from wagtail.core.models import Orderable
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.snippets.models import register_snippet

@register_snippet
class SportsTournamentSnippet(ClusterableModel):
    tournament_name = models.TextField(
        blank=False,
        null=False,
        default='tournament'
    )
    slug = AutoSlugField(
        populate_from="tournament_name",
        editable=True,
        primary_key=True,
        unique=True,
        blank=False,
        null=False,
    )
    
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('tournament_name'),
                FieldPanel('slug'),
            ],
            heading="Tournament Information"
        ),
        MultiFieldPanel(
            [
                InlinePanel("tournament_team", min_num=1, max_num=20, label="Tournament Team"),
            ],
            heading="Tournament Teams"
        ),
    ]

    def __str__(self):
        return self.tournament_name

    class Meta:
         verbose_name = "Sports Tournament"
         verbose_name_plural = "Sports Tournaments"

class SportsTeamOrderable(Orderable):
    """
    Based on individual team nodes
    """
    team_name = models.TextField(
        blank=False,
        null=False,
        default='',
    )
    ## we probably need to install https://pypi.org/project/django-colorfield/ for a more robust version of this
    team_color = models.CharField(
        blank=False,
        null=False,
        max_length=7,
        default='#FF0000',
        validators=[
            validate_colour_hex,
        ],
    )
    team_logo = models.ForeignKey(
        "wagtailimages.Image",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    tournament = ParentalKey(
        "SportsTournamentSnippet",
        default='',
        related_name="tournament_team",
    )

    # TODO: representation of location and of stats
    panels = [
        MultiFieldPanel(
            [
                FieldPanel('team_name'),
                FieldPanel('team_color'),
                ImageChooserPanel('team_logo'),
            ],
            heading="Team Information"
        ),
        # MultiFieldPanel(
        #     [
        #         InlinePanel("player_to_watch", max_num=1, label="Player to watch"),
        #     ],
        #     heading="Player to Watch"
        # ),
    ]

class SportsPlayerProfile(models.Model):
    full_name = models.CharField(
        max_length=255,
        blank=False,
        null=False,
    )
    profile_text = models.CharField(
        max_length=1500,
        blank=True,
        null=False,
    )
    player_photo = models.ForeignKey(
        "wagtailimages.Image",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # players_team = models.ForeignKey(
    #     "SportsTeamOrderable",
    #     related_name="player_to_watch",
    #     on_delete=models.CASCADE,
    # )
    panels = [
        FieldPanel('full_name'),
        FieldPanel('profile_text'),
        ImageChooserPanel('player_photo'),
    ]

    def __str__(self):
        return self.full_name
