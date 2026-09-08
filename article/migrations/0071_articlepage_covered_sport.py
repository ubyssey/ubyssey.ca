from django.db import migrations, models


SPORT_CHOICES = [
    ("basketball-w", "Basketball (W)"), ("basketball-m", "Basketball (M)"),
    ("football", "Football"), ("hockey-w", "Hockey (W)"), ("hockey-m", "Hockey (M)"),
    ("soccer-w", "Soccer (W)"), ("soccer-m", "Soccer (M)"), ("rugby-w", "Rugby (W)"),
    ("volleyball-w", "Volleyball (W)"), ("volleyball-m", "Volleyball (M)"),
]


class Migration(migrations.Migration):
    dependencies = [("article", "0069_standardarticlepage_extended_byline_override")]

    operations = [
        migrations.AddField(
            model_name="articlepage",
            name="covered_sport",
            field=models.CharField(blank=True, choices=SPORT_CHOICES, default="", max_length=20, verbose_name="Sport"),
        ),
    ]
