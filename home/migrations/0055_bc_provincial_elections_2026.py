from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0054_homepage_bc_elections_parties_note"),
    ]

    operations = [
        migrations.CreateModel(
            name="BCProvincialElectionsPage",
            fields=[
                ("page_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="wagtailcore.page")),
                ("intro_kicker", models.CharField(default="The Ubyssey · Election coverage", max_length=100)),
                ("election_summary", models.TextField(blank=True, default="", help_text="Short description below the page title.")),
                ("featured_label", models.CharField(default="How to vote", max_length=100)),
                ("party_heading", models.CharField(default="Party Explainers", max_length=100)),
                ("about_heading", models.CharField(default="About the Provincial Elections", max_length=100)),
                ("featured_article", models.ForeignKey(blank=True, help_text="How to vote story shown above the two story sections.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.AddField(model_name="homepage", name="bc_provincial_elections_page", field=models.ForeignKey(blank=True, help_text="Select the provincial elections page whose stories feed the homepage feature.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.bcprovincialelectionspage")),
        migrations.AddField(model_name="homepage", name="bc_provincial_banner_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="bc_provincial_banner_text", field=models.CharField(default="2026 BC PROVINCIAL ELECTIONS", max_length=150)),
        migrations.AddField(model_name="homepage", name="bc_provincial_panel_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="homepage", name="bc_provincial_panel_heading", field=models.CharField(default="2026 BC Provincial Elections", max_length=150)),
        migrations.AddField(model_name="homepage", name="bc_provincial_panel_description", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="bc_provincial_party_heading", field=models.CharField(default="Party Explainers", max_length=100)),
        migrations.AddField(model_name="homepage", name="bc_provincial_about_heading", field=models.CharField(default="About the Provincial Elections", max_length=100)),
        migrations.AddField(model_name="homepage", name="bc_provincial_show_featured", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="bc_provincial_show_parties", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="homepage", name="bc_provincial_show_about", field=models.BooleanField(default=True)),
        migrations.CreateModel(
            name="BCProvincialPartyExplainer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="party_explainers", to="home.bcprovincialelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
        migrations.CreateModel(
            name="BCProvincialAboutExplainer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("display_label", models.CharField(blank=True, default="", help_text="Optional short label; article headline remains the link text.", max_length=100)),
                ("article", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="article.articlepage")),
                ("page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="about_explainers", to="home.bcprovincialelectionspage")),
            ],
            options={"ordering": ("sort_order",)},
        ),
    ]
