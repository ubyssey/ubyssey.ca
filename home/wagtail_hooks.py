from django.urls import path, reverse

from wagtail import hooks
from wagtail.admin.menu import MenuItem

from home.views import sports_calendar_import


@hooks.register("register_admin_urls")
def register_sports_calendar_urls():
    return [path("sports-calendar/", sports_calendar_import, name="sports-calendar-import")]


@hooks.register("register_admin_menu_item")
def register_sports_calendar_menu_item():
    return MenuItem("Sports calendar", reverse("sports-calendar-import"), icon_name="date", order=850)
