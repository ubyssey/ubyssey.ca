from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields
import wagtail.fields


class Migration(migrations.Migration):
    dependencies = [("article", "0071_articlepage_covered_sport"), ("images", "0008_alter_ubysseyimage_description"), ("home", "0045_alter_homepage_game_analysis_sports")]

    operations = [
        migrations.CreateModel(
            name="HomepageRedesignStory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="+", to="article.articlepage")),
                ("home_page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="redesign_story_queue", to="home.homepage")),
            ],
            options={"ordering": ("sort_order",), "verbose_name": "Homepage story", "verbose_name_plural": "Homepage story queue"},
        ),
        migrations.AddField(model_name="homepage", name="redesign_hero_headline_position", field=models.CharField(choices=[("below", "Below the cover image (default)"), ("above", "Above the cover image")], default="below", max_length=10)),
        migrations.AddField(model_name="homepage", name="redesign_hero_headline_variant", field=models.CharField(choices=[("default", "Default Meursault"), ("compact", "Compact Meursault"), ("wide", "Wide Meursault")], default="default", max_length=10)),
        migrations.AddField(model_name="homepage", name="newsletter_title", field=models.CharField(blank=True, default="", max_length=80)),
        migrations.AddField(model_name="homepage", name="newsletter_copy", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="newsletter_button_text", field=models.CharField(blank=True, default="", max_length=40)),
        migrations.AddField(model_name="homepage", name="newsletter_rss_url", field=models.URLField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="newsletter_honeypot_name", field=models.CharField(blank=True, default="", max_length=160)),
        migrations.AddField(model_name="homepage", name="print_issue_image", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="images.ubysseyimage")),
        migrations.AddField(model_name="homepage", name="print_issue_url", field=models.URLField(blank=True, default="")),
        migrations.AddField(model_name="homepage", name="print_issue_label", field=models.CharField(blank=True, default="", max_length=100)),
        migrations.AlterField(
            model_name="homepage",
            name="game_analysis",
            field=wagtail.fields.StreamField(
                [("panel", 13)],
                blank=True,
                null=True,
                help_text="Homepage sports analysis stories, active sports, upcoming games and recent results.",
                block_lookup={
                    0: ("wagtail.blocks.MultipleChoiceBlock", [], {"choices": [("basketball-w", "Basketball (W)"), ("basketball-m", "Basketball (M)"), ("football", "Football"), ("hockey-w", "Hockey (W)"), ("hockey-m", "Hockey (M)"), ("soccer-w", "Soccer (W)"), ("soccer-m", "Soccer (M)"), ("rugby-w", "Rugby (W)"), ("volleyball-w", "Volleyball (W)"), ("volleyball-m", "Volleyball (M)")], "help_text": "Sports shown in the homepage filter bar.", "required": False}),
                    1: ("wagtail.blocks.PageChooserBlock", (), {"page_type": ["article.ArticlePage"]}),
                    2: ("wagtail.blocks.ChoiceBlock", [], {"choices": [("basketball-w", "Basketball (W)"), ("basketball-m", "Basketball (M)"), ("football", "Football"), ("hockey-w", "Hockey (W)"), ("hockey-m", "Hockey (M)"), ("soccer-w", "Soccer (W)"), ("soccer-m", "Soccer (M)"), ("rugby-w", "Rugby (W)"), ("volleyball-w", "Volleyball (W)"), ("volleyball-m", "Volleyball (M)")], "help_text": "Legacy fallback. The article's Sport metadata is used when available.", "required": False}),
                    3: ("wagtail.blocks.StructBlock", [[("article", 1), ("sport", 2)]], {}),
                    4: ("wagtail.blocks.ListBlock", (3,), {"required": False}),
                    5: ("wagtail.blocks.DateTimeBlock", (), {"required": False}),
                    6: ("wagtail.blocks.CharBlock", (), {"max_length": 120, "required": False}),
                    7: ("wagtail.blocks.CharBlock", (), {"max_length": 80}),
                    8: ("wagtail.images.blocks.ImageChooserBlock", (), {"required": False}),
                    9: ("wagtail.blocks.IntegerBlock", (), {"required": False}),
                    10: ("wagtail.blocks.StructBlock", [[("name", 7), ("icon", 8), ("score", 9)]], {}),
                    11: ("wagtail.blocks.StructBlock", [[("sport", 2), ("starts_at", 5), ("venue", 6), ("away_team", 10), ("home_team", 10)]], {}),
                    12: ("wagtail.blocks.ListBlock", (11,), {"max_num": 8, "required": False}),
                    13: ("wagtail.blocks.StructBlock", [[("active_sports", 0), ("articles", 4), ("upcoming_games", 12), ("recent_results", 12)]], {}),
                },
            ),
        ),
    ]
