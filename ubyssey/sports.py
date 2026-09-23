"""Shared editorial sport metadata used by the homepage and article CMS."""

SPORT_CHOICES = (
    ("basketball-w", "Basketball (W)"),
    ("basketball-m", "Basketball (M)"),
    ("football", "Football"),
    ("hockey-w", "Hockey (W)"),
    ("hockey-m", "Hockey (M)"),
    ("soccer-w", "Soccer (W)"),
    ("soccer-m", "Soccer (M)"),
    ("rugby-w", "Rugby (W)"),
    ("volleyball-w", "Volleyball (W)"),
    ("volleyball-m", "Volleyball (M)"),
)

# Keep the complete taxonomy for historic article and fixture records.  The
# current Game Analyses panel deliberately has a smaller active programme: it
# must not surface Women's Rugby in a new term without erasing past coverage.
GAME_ANALYSIS_ACTIVE_SPORT_CHOICES = tuple(
    choice for choice in SPORT_CHOICES if choice[0] != "rugby-w"
)
