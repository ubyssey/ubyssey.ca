"""Small, selection-scoped queries for the homepage Game Analyses panel."""

from article.models import ArticlePage
from ubyssey.sports import GAME_ANALYSIS_ACTIVE_SPORT_CHOICES


STORY_LIMIT = 4
FIXTURE_LIMIT = 5
ACTIVE_SPORTS = tuple(sport for sport, _label in GAME_ANALYSIS_ACTIVE_SPORT_CHOICES)


def panel_active_sports(panel_value=None):
    """Return the CMS-enabled sports, or all current sports without a panel."""
    configured = panel_value.get("active_sports", []) if panel_value else []
    return [sport for sport in configured if sport in ACTIVE_SPORTS] or list(ACTIVE_SPORTS)


def fixture_queues(sports, now):
    from home.models import ThunderbirdFixture

    fixtures = ThunderbirdFixture.objects.filter(sport__in=sports).select_related(
        "game_analysis_article"
    )
    upcoming = list(
        fixtures.filter(starts_at__gte=now).order_by("starts_at", "pk")[:FIXTURE_LIMIT]
    )
    recent = list(
        fixtures.filter(starts_at__lt=now).order_by("-starts_at", "-pk")[:FIXTURE_LIMIT]
    )
    return upcoming, recent


def chronological_articles(sports):
    """Return only the newest four live Game Analysis stories for this selection."""
    return list(
        ArticlePage.objects.live()
        .public()
        .filter(
            standardarticlepage__story_form="game-analysis",
            covered_sport__in=sports,
        )
        .order_by("-explicit_published_at", "-pk")
        .specific()[:STORY_LIMIT]
    )
