"""Present fixture and championship results through one article score bug."""

import re


# Existing calendar logos are static files; these defaults give published
# fixture stories a team palette before an editor fine-tunes either colour.
TEAM_COLORS = {
    "UBC Thunderbirds": "#002145",
    "UBC": "#002145",
    "University of the Fraser Valley": "#006B45",
    "Trinity Western University": "#003B71",
    "UBC-Okanagan": "#C88A2B",
    "University of Calgary": "#B31B34",
    "University of Alberta": "#007C41",
    "University of Alberta Pandas": "#007C41",
    "University of Victoria": "#005596",
    "University of Manitoba": "#7B5B22",
    "University of Regina": "#00684A",
    "University of Regina Rams": "#00684A",
    "University of Saskatchewan": "#006A4E",
    "University of Northern British Columbia": "#007A82",
    "University of Lethbridge": "#003E73",
    "Thompson Rivers University": "#A6263E",
    "TRU": "#A6263E",
    "Ottawa": "#8C163C",
    "Ottawa Gee-Gees": "#8C163C",
    "TWU": "#003B71",
    "Montréal": "#00539F",
    "Montreal": "#00539F",
    "Guelph": "#B21E35",
    "Dalhousie": "#D6AA18",
    "Laval": "#C62B30",
    "MacEwan University": "#6E1F43",
    "Mount Royal University": "#003D79",
}
DEFAULT_COLOR = "#223377"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def team_color(override, name):
    if override and HEX_COLOR.fullmatch(override):
        return override
    return TEAM_COLORS.get(name, DEFAULT_COLOR)


def comparison_stats(value):
    stats = []
    for item in value or []:
        data = getattr(item, "value", item)
        if not hasattr(data, "get"):
            continue
        label = data.get("label", "")
        away = data.get("away_value", "")
        home = data.get("home_value", "")
        if away or home:
            stats.append({"label": label, "away": away or "—", "home": home or "—"})
    return stats


def article_scorebug(article):
    """Return a score bug for a Game Analysis with a scored linked match."""
    if getattr(article, "story_form", None) != "game-analysis":
        return None

    # A championship match is the authority when a story has both links.
    from home.models import WomensSoccerMatch

    match = None
    if article.pk:
        match = (
            WomensSoccerMatch.objects.select_related("home_team__logo", "away_team__logo")
            .filter(analysis_id=article.pk, page__live=True)
            .first()
        )
    if match and match.has_score and match.home_team and match.away_team:
        away_team, home_team = match.away_team, match.home_team
        return {
            "sport": "Women's soccer",
            "status": "Final" if match.is_final else "Score reported",
            "starts_at": match.starts_at,
            "venue": "",
            "detail": match.result_note,
            "away": {
                "name": away_team.name, "score": match.away_score,
                "logo_image": away_team.logo,
                "color": team_color(away_team.scorebug_color, away_team.name),
            },
            "home": {
                "name": home_team.name, "score": match.home_score,
                "logo_image": home_team.logo,
                "color": team_color(home_team.scorebug_color, home_team.name),
            },
            "stats": comparison_stats(match.scorebug_stats),
        }

    fixture = getattr(article, "game_fixture", None)
    if fixture is None or fixture.away_score is None or fixture.home_score is None:
        return None
    return {
        "sport": fixture.get_sport_display(),
        "status": "Final",
        "starts_at": fixture.starts_at,
        "venue": fixture.venue,
        "detail": "",
        "away": {
            "name": fixture.away_name, "score": fixture.away_score,
            "logo_static": fixture.away_logo,
            "color": team_color(fixture.away_scorebug_color, fixture.away_name),
        },
        "home": {
            "name": fixture.home_name, "score": fixture.home_score,
            "logo_static": fixture.home_logo,
            "color": team_color(fixture.home_scorebug_color, fixture.home_name),
        },
        "stats": comparison_stats(fixture.scorebug_stats),
    }
