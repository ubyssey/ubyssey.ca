from django.apps import AppConfig

class HomeConfig(AppConfig):
    name = 'home'

    def ready(self) -> None:
        import home.signals #see https://www.youtube.com/watch?v=Kc1Q_ayAeQk
        return super().ready()