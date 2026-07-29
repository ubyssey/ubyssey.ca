import django.db.models.deletion
import modelcluster.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("join", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="joinlandingpage",
            name="application_process_heading",
            field=models.CharField(
                default="Application Process",
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name="joinlandingpage",
            name="application_process_introduction",
            field=models.TextField(
                blank=True,
                default=(
                    "Our application process takes about three weeks, from the "
                    "time we post roles to when we onboard new hires."
                ),
            ),
        ),
        migrations.CreateModel(
            name="JoinApplicationStep",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "sort_order",
                    models.IntegerField(blank=True, editable=False, null=True),
                ),
                ("title", models.CharField(max_length=160)),
                ("description", models.TextField()),
                (
                    "page",
                    modelcluster.fields.ParentalKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="application_steps",
                        to="join.joinlandingpage",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order"],
                "abstract": False,
            },
        ),
    ]
