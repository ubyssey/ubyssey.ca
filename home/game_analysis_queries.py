"""Bound the homepage Game Analyses data without changing client-side filters."""

from django.db.models import F, Window
from django.db.models.functions import RowNumber

from article.models import ArticlePage


# A selection of several sports can draw its first N entries from any one
# sport. Keeping the first N *per sport* therefore preserves the first N for
# every possible selection while avoiding the full historical fixture queue.
STORY_LIMIT = 4
FIXTURE_LIMIT = 5


def fixture_queues(sports, now):
    from home.models import ThunderbirdFixture

    fixtures = ThunderbirdFixture.objects.filter(sport__in=sports)
    upcoming_ids = list(
        fixtures.filter(starts_at__gte=now)
        .annotate(
            sport_rank=Window(
                expression=RowNumber(),
                partition_by=[F("sport")],
                order_by=[F("starts_at").asc(), F("pk").asc()],
            )
        )
        .filter(sport_rank__lte=FIXTURE_LIMIT)
        .order_by("starts_at", "pk")
        .values_list("pk", flat=True)
    )
    recent_ids = list(
        fixtures.filter(starts_at__lt=now)
        .annotate(
            sport_rank=Window(
                expression=RowNumber(),
                partition_by=[F("sport")],
                order_by=[F("starts_at").desc(), F("pk").desc()],
            )
        )
        .filter(sport_rank__lte=FIXTURE_LIMIT)
        .order_by("-starts_at", "-pk")
        .values_list("pk", flat=True)
    )
    # Rank only fixture IDs; load the selected rows and linked stories after
    # the window query so MySQL does not sort the joined article records.
    selected = ThunderbirdFixture.objects.select_related("game_analysis_article").in_bulk(
        set(upcoming_ids + recent_ids)
    )
    return [selected[pk] for pk in upcoming_ids], [selected[pk] for pk in recent_ids]


def chronological_articles(sports):
    """Return the newest four live Game Analysis stories per active sport."""
    ranked_ids = list(
        ArticlePage.objects.live()
        .public()
        .filter(
            standardarticlepage__story_form="game-analysis",
            covered_sport__in=sports,
        )
        .annotate(
            sport_rank=Window(
                expression=RowNumber(),
                partition_by=[F("covered_sport")],
                order_by=[F("explicit_published_at").desc(), F("pk").desc()],
            )
        )
        .filter(sport_rank__lte=STORY_LIMIT)
        .values_list("pk", flat=True)
    )
    return ArticlePage.objects.live().public().filter(pk__in=ranked_ids).order_by(
        "-explicit_published_at", "-pk"
    ).specific()
