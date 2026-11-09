from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("section", "0031_sectionpage_editor_email_override"),
        ("home", "0056_womens_soccer_championship"),
    ]

    operations = [
        migrations.AddField(model_name="sectionpage", name="soccer_championship_page", field=models.ForeignKey(blank=True, help_text="For the main Sports section only: select the published championship hub.", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="home.womenssoccerchampionshippage")),
        migrations.AddField(model_name="sectionpage", name="soccer_championship_panel_enabled", field=models.BooleanField(default=False, help_text="Show the championship panel between the Sports hero and story feed. Hidden on beats.")),
    ]
