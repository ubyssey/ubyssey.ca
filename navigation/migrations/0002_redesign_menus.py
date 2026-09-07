from django.db import migrations, models
import django.db.models.deletion
import modelcluster.fields


def menu_item(name, related_name):
    return migrations.CreateModel(
        name=name,
        fields=[
            ("navigationmenuorderable_ptr", models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to="navigation.navigationmenuorderable")),
            ("navigation_menu", modelcluster.fields.ParentalKey(on_delete=django.db.models.deletion.CASCADE, related_name=related_name, to="navigation.sitewidemenus")),
        ],
        options={"ordering": ["sort_order"], "abstract": False},
        bases=("navigation.navigationmenuorderable",),
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0001_initial")]

    operations = [
        menu_item("RedesignExpandedSectionsItem", "redesign_expanded_sections"),
        menu_item("RedesignExpandedMoreItem", "redesign_expanded_more"),
        menu_item("RedesignExpandedAboutItem", "redesign_expanded_about"),
        menu_item("RedesignExpandedContactItem", "redesign_expanded_contact"),
        menu_item("RedesignFooterSectionsItem", "redesign_footer_sections"),
        menu_item("RedesignFooterConnectItem", "redesign_footer_connect"),
        menu_item("RedesignFooterAboutItem", "redesign_footer_about"),
        menu_item("RedesignFooterJoinItem", "redesign_footer_join"),
    ]
