from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0055_bc_provincial_elections_2026"),
        ("article", "0077_standardarticlepage_video_header"),
        ("images", "0009_ubysseyimage_redesign_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="WomensSoccerChampionshipPage",
            fields=[
                ("page_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="wagtailcore.page")),
                ("intro_kicker", models.CharField(default="The Ubyssey · Championship coverage", max_length=100)),
                ("summary", models.TextField(blank=True, default="")),
                ("featured_label", models.CharField(default="Gold medal match", max_length=100)),
                ("about_heading", models.CharField(default="About the Championship", max_length=100)),
                ("results_heading", models.CharField(default="Bracket & Table", max_length=100)),
                ("analyses_heading", models.CharField(default="Match Analyses", max_length=100)),
                ("featured_article", models.ForeignKey(blank=True, help_text="Optional gold medal match story above the sections.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.CreateModel(
            name="WomensSoccerTeamsPage",
            fields=[
                ("page_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="wagtailcore.page")),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.CreateModel(
            name="WomensSoccerMatchesPage",
            fields=[
                ("page_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="wagtailcore.page")),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.AddField(model_name="homepage", name="soccer_championship_page", field=models.ForeignKey(blank=True, help_text="Published championship hub supplying the homepage feature.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.womenssoccerchampionshippage")),
        migrations.AddField(model_name="homepage", name="soccer_championship_banner_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="soccer_championship_banner_text", field=models.CharField(default="2026 U SPORTS WOMEN'S SOCCER CHAMPIONSHIP", max_length=150)),
        migrations.AddField(model_name="homepage", name="soccer_championship_panel_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="soccer_championship_panel_heading", field=models.CharField(default="2026 U SPORTS Women's Soccer Championship", max_length=150)),
        migrations.AddField(model_name="homepage", name="soccer_championship_panel_description", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="soccer_championship_show_featured", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="soccer_championship_show_explainers", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="soccer_championship_show_results", field=models.BooleanField(default=True)),
        migrations.CreateModel(
            name="WomensSoccerExplainer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="explainers", to="home.womenssoccerchampionshippage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.CreateModel(
            name="WomensSoccerTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("seed", models.PositiveSmallIntegerField(help_text="Original tournament seed, 1–8; shown in the bracket and table.")),
                ("name", models.CharField(max_length=100)),
                ("short_name", models.CharField(help_text="Compact name for the narrow table column.", max_length=30)),
                ("games_played", models.PositiveSmallIntegerField(default=0)),
                ("shots", models.PositiveIntegerField(default=0)),
                ("goals", models.PositiveIntegerField(default=0)),
                ("assists", models.PositiveIntegerField(default=0)),
                ("points", models.PositiveIntegerField(default=0)),
                ("logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="images.ubysseyimage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="teams", to="home.womenssoccerteamspage")),
            ],
            options={"ordering": ("seed",)},
        ),
        migrations.AddConstraint(model_name="womenssoccerteam", constraint=models.UniqueConstraint(fields=("page", "seed"), name="unique_soccer_champ_seed")),
        migrations.CreateModel(
            name="WomensSoccerMatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("slot", models.CharField(choices=[("qf1", "Quarterfinal 1"), ("qf2", "Quarterfinal 2"), ("qf3", "Quarterfinal 3"), ("qf4", "Quarterfinal 4"), ("sf1", "Championship semifinal 1"), ("sf2", "Championship semifinal 2"), ("csf1", "Consolation semifinal 1"), ("csf2", "Consolation semifinal 2"), ("fifth", "Fifth-place match"), ("bronze", "Bronze medal match"), ("gold", "Gold medal match")], max_length=8)),
                ("starts_at", models.DateTimeField(blank=True, help_text="Local match time; the site displays Pacific time.", null=True)),
                ("home_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("away_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("result_note", models.CharField(blank=True, default="", help_text="Optional result detail, such as penalties.", max_length=100)),
                ("is_final", models.BooleanField(default=False)),
                ("analysis", models.ForeignKey(blank=True, help_text="Published Game Analysis story; its link appears beside this match and in the analyses section.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("away_team", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.womenssoccerteam")),
                ("home_team", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.womenssoccerteam")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="matches", to="home.womenssoccermatchespage")),
                ("winner", models.ForeignKey(blank=True, help_text="Select the winner after the match, including matches decided on penalties.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.womenssoccerteam")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.AddConstraint(model_name="womenssoccermatch", constraint=models.UniqueConstraint(fields=("page", "slot"), name="unique_soccer_champ_match_slot")),
    ]
