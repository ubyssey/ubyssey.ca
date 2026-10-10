from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0052_homepage_game_analysis_enabled"),
        ("article", "0075_alter_standardarticlepage_content"),
        ("images", "0009_ubysseyimage_redesign_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="BCLocalElectionsPage",
            fields=[
                ("page_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="wagtailcore.page")),
                ("intro_kicker", models.CharField(default="The Ubyssey · Election coverage", max_length=100)),
                ("election_summary", models.TextField(blank=True, default="", help_text="Short description below the page title.")),
                ("about_heading", models.CharField(default="About the Elections", max_length=100)),
                ("vancouver_heading", models.CharField(default="Vancouver Mayoral Candidates", max_length=100)),
                ("parties_heading", models.CharField(default="About the Parties", max_length=100)),
                ("metro_heading", models.CharField(default="Greater Vancouver Mayoral Candidates", max_length=100)),
                ("parties_extra_text", models.TextField(blank=True, default="", help_text="Optional note in the eighth position of the party grid.")),
                ("live_results_label", models.CharField(default="Election results", max_length=100)),
                ("live_active_label", models.CharField(default="LIVE", max_length=30)),
                ("live_results_ended_at", models.DateTimeField(blank=True, help_text="Optional end time shown once live updates stop. Defaults to the last update time.", null=True)),
                ("live_results_article", models.ForeignKey(blank=True, help_text="Optional live-results story shown above the four story sections.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.AddField(model_name="homepage", name="bc_elections_page", field=models.ForeignKey(blank=True, help_text="Select the election page whose story slots and party logos feed the homepage feature.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.bclocalelectionspage")),
        migrations.AddField(model_name="homepage", name="bc_elections_banner_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="bc_elections_banner_text", field=models.CharField(default="2026 BC GENERAL LOCAL ELECTIONS", max_length=150)),
        migrations.AddField(model_name="homepage", name="bc_elections_panel_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="bc_elections_panel_heading", field=models.CharField(default="2026 BC General Local Elections", max_length=150)),
        migrations.AddField(model_name="homepage", name="bc_elections_panel_description", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="bc_elections_explainers_heading", field=models.CharField(default="About the Elections", max_length=100)),
        migrations.AddField(model_name="homepage", name="bc_elections_vancouver_heading", field=models.CharField(default="Vancouver Mayoral Candidates", max_length=100)),
        migrations.AddField(model_name="homepage", name="bc_elections_parties_heading", field=models.CharField(default="About the Parties", max_length=100)),
        migrations.AddField(model_name="homepage", name="bc_elections_metro_link_text", field=models.CharField(default="Explore Greater Vancouver mayoral candidates", max_length=120)),
        migrations.AddField(model_name="homepage", name="bc_elections_show_explainers", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="bc_elections_show_vancouver", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="bc_elections_show_parties", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="bc_elections_show_live_results", field=models.BooleanField(default=True)),
        migrations.CreateModel(
            name="BCElectionExplainer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="explainers", to="home.bclocalelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.CreateModel(
            name="BCElectionVancouverProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("is_context_card", models.BooleanField(default=False, help_text="Use for the MVRD acclaimed profile and information mix; gives the card a distinct treatment.")),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="vancouver_profiles", to="home.bclocalelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.CreateModel(
            name="BCElectionPartyProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="images.ubysseyimage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="party_profiles", to="home.bclocalelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.CreateModel(
            name="BCElectionMetroProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="metro_profiles", to="home.bclocalelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
    ]
