from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


class Migration(migrations.Migration):
    dependencies = [("authors", "0022_authorpage_noindex")]

    operations = [
        migrations.CreateModel(
            name="AuthorContactOrderable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.IntegerField(blank=True, editable=False, null=True)),
                ("label", models.CharField(max_length=40)),
                ("url", models.URLField(help_text="Use mailto: for an email address, or an https URL.")),
                ("author_page", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name="contact_options", to="authors.authorpage")),
            ],
            options={"ordering": ("sort_order",), "verbose_name": "Contact option", "verbose_name_plural": "Contact options"},
        ),
        migrations.AddField(model_name="authorpage", name="contact_email", field=models.EmailField(blank=True, default="", help_text="Primary public email used in the redesigned author and section-editor panels.", max_length=254)),
    ]
