from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("wagtailcore", "0062_comment_models_and_pagesubscription"),
        ("wagtailimages", "0001_initial"),
        ("liveblog", "0005_alter_liveblogupdate_content"),
    ]

    operations = [
        migrations.CreateModel(
            name="ElectionResultsSettings",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("automatic_updates_enabled", models.BooleanField(default=False, help_text="Off by default. When on, fetch every five minutes only while the linked article is live.")),
                ("site", models.OneToOneField(editable=False, on_delete=django.db.models.deletion.CASCADE, to="wagtailcore.site")),
                ("liveblog_page", models.ForeignKey(blank=True, help_text="Only this live-updates article shows the results sidebar.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="liveblog.liveblogarticlepage")),
                ("pete_fry_image", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("pete_fry_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailcore.page")),
                ("ken_sim_image", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("ken_sim_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailcore.page")),
                ("colleen_hardwick_image", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("colleen_hardwick_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailcore.page")),
                ("kareem_allam_image", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("kareem_allam_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailcore.page")),
                ("rebecca_bligh_image", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("rebecca_bligh_profile", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailcore.page")),
                ("cope_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("onecity_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("vote_vancouver_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("vancouver_greens_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("vancouver_liberals_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("team_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
                ("abc_vancouver_logo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="wagtailimages.image")),
            ],
            options={"verbose_name": "2026 election results"},
        ),
        migrations.CreateModel(
            name="ElectionResultsSnapshot",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data", models.JSONField()),
                ("source_timestamp", models.DateTimeField()),
                ("imported_at", models.DateTimeField(auto_now=True)),
                ("source", models.CharField(choices=[("sftp", "SFTP"), ("upload", "Manual upload")], max_length=16)),
                ("sha256", models.CharField(max_length=64)),
                ("site", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="election_results_snapshot", to="wagtailcore.site")),
            ],
        ),
    ]
