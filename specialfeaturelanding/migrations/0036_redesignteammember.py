from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ("authors", "0024_alter_authorcontactorderable_id"),
        ("specialfeaturelanding", "0035_redesignauxiliarypage"),
    ]

    operations = [
        migrations.CreateModel(
            name="RedesignTeamMember",
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
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                (
                    "department",
                    models.CharField(
                        choices=[
                            ("senior", "Senior Masthead"),
                            ("reportage", "Reportage"),
                            ("visuals", "Visuals"),
                            ("product", "Product"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "description_override",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text=(
                            "Optional longer description for this card only. It overrides "
                            "the author page's short biography without changing the author page."
                        ),
                    ),
                ),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="+",
                        to="authors.authorpage",
                    ),
                ),
                (
                    "page",
                    modelcluster.fields.ParentalKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="team_members",
                        to="specialfeaturelanding.redesignauxiliarypage",
                    ),
                ),
            ],
            options={
                "ordering": ("sort_order",),
                "verbose_name": "Our Team member",
                "verbose_name_plural": "Our Team members",
            },
        ),
    ]
