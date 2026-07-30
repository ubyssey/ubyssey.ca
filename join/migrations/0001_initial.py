# Generated for Django 5.2 and Wagtail 7.0.

import django.db.models.deletion
import modelcluster.fields
import wagtail.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("images", "0008_alter_ubysseyimage_description"),
        ("wagtailcore", "0089_log_entry_data_json_null_to_object"),
    ]

    operations = [
        migrations.CreateModel(
            name="JoinLandingPage",
            fields=[
                (
                    "page_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="wagtailcore.page",
                    ),
                ),
                (
                    "hero_eyebrow",
                    models.CharField(
                        default="So you want to be a journalist?",
                        max_length=120,
                    ),
                ),
                (
                    "hero_heading",
                    models.CharField(default="Join The Ubyssey", max_length=120),
                ),
                (
                    "introduction",
                    wagtail.fields.RichTextField(
                        blank=True,
                        features=["bold", "italic", "link"],
                    ),
                ),
                ("reportage_description", models.TextField(blank=True)),
                ("visuals_description", models.TextField(blank=True)),
                ("product_description", models.TextField(blank=True)),
                (
                    "faq_heading",
                    models.CharField(
                        default="Frequently Asked Questions about the CJP",
                        max_length=160,
                    ),
                ),
                (
                    "career_heading",
                    models.CharField(
                        default="Growing with The Ubyssey",
                        max_length=160,
                    ),
                ),
                ("career_introduction", models.TextField(blank=True)),
                (
                    "hero_image",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="images.ubysseyimage",
                    ),
                ),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.CreateModel(
            name="JoinUnitPage",
            fields=[
                (
                    "page_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="wagtailcore.page",
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("reportage", "Reportage"),
                            ("visuals", "Visuals"),
                            ("product", "Product"),
                        ],
                        default="reportage",
                        max_length=20,
                    ),
                ),
                (
                    "unit_type",
                    models.CharField(
                        choices=[
                            ("Section", "Section"),
                            ("Department", "Department"),
                        ],
                        default="Section",
                        max_length=20,
                    ),
                ),
                (
                    "card_description",
                    models.TextField(
                        help_text="Short description shown on the /join/ unit card."
                    ),
                ),
                (
                    "introduction",
                    wagtail.fields.RichTextField(
                        features=["bold", "italic", "link", "ol", "ul"]
                    ),
                ),
                ("unit_email", models.EmailField(blank=True, max_length=254)),
                ("contact_role", models.CharField(blank=True, max_length=120)),
                ("contact_name", models.CharField(blank=True, max_length=120)),
                ("contact_email", models.EmailField(blank=True, max_length=254)),
                (
                    "hero_image",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="images.ubysseyimage",
                    ),
                ),
            ],
            options={"abstract": False},
            bases=("wagtailcore.page",),
        ),
        migrations.CreateModel(
            name="JoinFAQ",
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
                ("question", models.CharField(max_length=255)),
                (
                    "answer",
                    wagtail.fields.RichTextField(
                        features=["bold", "italic", "link", "ol", "ul"]
                    ),
                ),
                (
                    "page",
                    modelcluster.fields.ParentalKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="faqs",
                        to="join.joinlandingpage",
                    ),
                ),
            ],
            options={"ordering": ["sort_order"], "abstract": False},
        ),
        migrations.CreateModel(
            name="JoinCareerStage",
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
                ("subtitle", models.CharField(blank=True, max_length=200)),
                ("description", models.TextField()),
                (
                    "page",
                    modelcluster.fields.ParentalKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="career_stages",
                        to="join.joinlandingpage",
                    ),
                ),
            ],
            options={"ordering": ["sort_order"], "abstract": False},
        ),
        migrations.CreateModel(
            name="JoinPosition",
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
                ("title", models.CharField(max_length=180)),
                (
                    "description",
                    wagtail.fields.RichTextField(
                        features=["bold", "italic", "link", "ol", "ul"]
                    ),
                ),
                (
                    "application_url",
                    models.URLField(
                        blank=True,
                        help_text=(
                            "The position accepts applications whenever this URL "
                            "is populated. Leave it empty to show it as closed."
                        ),
                    ),
                ),
                (
                    "page",
                    modelcluster.fields.ParentalKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="positions",
                        to="join.joinunitpage",
                    ),
                ),
            ],
            options={"ordering": ["sort_order"], "abstract": False},
        ),
    ]
