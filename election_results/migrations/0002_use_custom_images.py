from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("election_results", "0001_initial"),
        ("images", "0009_ubysseyimage_redesign_description"),
    ]

    operations = [
        migrations.AlterField(
            model_name="electionresultssettings",
            name=name,
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="images.ubysseyimage",
            ),
        )
        for name in (
            "pete_fry_image", "ken_sim_image", "colleen_hardwick_image",
            "kareem_allam_image", "rebecca_bligh_image", "cope_logo",
            "onecity_logo", "vote_vancouver_logo", "vancouver_greens_logo",
            "vancouver_liberals_logo", "team_logo", "abc_vancouver_logo",
        )
    ]
