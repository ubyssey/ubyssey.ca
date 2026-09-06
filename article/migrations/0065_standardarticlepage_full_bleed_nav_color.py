from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("article", "0064_article_redesign_fields")]
    operations = [
        migrations.AddField(
            model_name="standardarticlepage",
            name="full_bleed_nav_color",
            field=models.CharField(
                choices=[("white", "White"), ("black", "Black")],
                default="white",
                help_text="Full-bleed articles only: choose the navigation colour that contrasts with the hero image.",
                max_length=5,
            ),
        ),
    ]
