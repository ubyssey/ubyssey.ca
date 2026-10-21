from django.urls import path, reverse
from wagtail import hooks
from wagtail.admin.menu import MenuItem

from .views import results_admin


class ElectionResultsMenuItem(MenuItem):
    def is_shown(self, request):
        return request.user.has_perm("election_results.change_electionresultssettings")


@hooks.register("register_admin_urls")
def register_results_urls():
    return [path("election-results/", results_admin, name="election-results-admin")]


@hooks.register("register_admin_menu_item")
def register_results_menu():
    return ElectionResultsMenuItem("Election results", reverse("election-results-admin"), icon_name="doc-full", order=855)
