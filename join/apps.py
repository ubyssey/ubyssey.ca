from django.apps import AppConfig


class JoinConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "join"
    verbose_name = "Join The Ubyssey"

    def ready(self):
        from home.models import HomePage

        join_page_type = "join.JoinLandingPage"
        if join_page_type not in HomePage.subpage_types:
            HomePage.subpage_types.append(join_page_type)
