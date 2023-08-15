from wagtail.contrib.modeladmin.options import ModelAdmin, modeladmin_register

from .models import AdSlot


class AdAdmin(ModelAdmin):
    model = AdSlot
    menu_label = "Register Ad Slots"
    menu_icon = "cogs"
    menu_order = 1000
    add_to_settings_menu = True
    list_display = ("slug", "dfp", "size", "div_id", "div_class")


modeladmin_register(AdAdmin)
