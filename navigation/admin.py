# from wagtail.contrib.modeladmin.options import (
#     ModelAdmin,
#     modeladmin_register,
# )
# from .models import SitewideMenus

# @modeladmin_register
# class SitewideMenusAdmin(ModelAdmin):
#     """
#     Allow user modification of the site's menus.
#     """

#     model = SitewideMenus
#     menu_label = "Site wide menus"
#     menu_icon = "cogs"
#     menu_order = 500
#     add_to_settings_menu = True
#     exclude_from_explorer = False
#     list_display = ('main_header_menu', 'left_header_menu', 'right_header_menu', 'main_footer_menu', 'second_footer_menu',)
