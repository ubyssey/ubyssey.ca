from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):
    dependencies = [("authors", "0023_authorpage_redesign_contacts"), ("section", "0027_sectionpage_spotify_episode_url")]

    operations = [
        migrations.CreateModel(
            name="SectionRedesignFeaturedArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="+", to="article.articlepage")),
                ("section_page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="redesign_featured_articles", to="section.sectionpage")),
            ],
            options={"ordering": ("sort_order",), "verbose_name": "Featured redesign story", "verbose_name_plural": "Featured redesign stories"},
        ),
        migrations.AddField(model_name="sectionpage", name="redesign_tip_title", field=models.CharField(blank=True, default="", max_length=100)),
        migrations.AddField(model_name="sectionpage", name="redesign_tip_body", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="sectionpage", name="redesign_tip_link_text", field=models.CharField(blank=True, default="", max_length=50)),
        migrations.AddField(model_name="sectionpage", name="redesign_tip_link_url", field=models.URLField(blank=True, default="")),
        migrations.AddField(model_name="sectionpage", name="redesign_editor", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="edited_redesign_sections", to="authors.authorpage")),
    ]
