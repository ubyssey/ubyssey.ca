from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("home", "0043_homepage_redesign_fields")]

    operations = [
        migrations.CreateModel(
            name="ThunderbirdFixture",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_event", models.CharField(editable=False, max_length=255, unique=True)),
                ("sport", models.CharField(choices=[("basketball-w", "Basketball (W)"), ("basketball-m", "Basketball (M)"), ("football", "Football"), ("hockey-w", "Hockey (W)"), ("hockey-m", "Hockey (M)"), ("soccer-w", "Soccer (W)"), ("soccer-m", "Soccer (M)"), ("rugby-w", "Rugby (W)"), ("volleyball-w", "Volleyball (W)"), ("volleyball-m", "Volleyball (M)")], max_length=20)),
                ("starts_at", models.DateTimeField(db_index=True)),
                ("venue", models.CharField(blank=True, max_length=180)),
                ("away_name", models.CharField(max_length=100)),
                ("home_name", models.CharField(max_length=100)),
                ("away_logo", models.CharField(blank=True, editable=False, max_length=180)),
                ("home_logo", models.CharField(blank=True, editable=False, max_length=180)),
                ("away_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("home_score", models.PositiveSmallIntegerField(blank=True, null=True)),
            ],
            options={"verbose_name": "Thunderbird fixture", "verbose_name_plural": "Thunderbird fixtures", "ordering": ("starts_at",)},
        )
    ]
