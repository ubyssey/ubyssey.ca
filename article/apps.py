from django.apps import AppConfig


class ArticleConfig(AppConfig):
    name = 'article'

    def ready(self) -> None:
        import article.signals #see https://www.youtube.com/watch?v=Kc1Q_ayAeQk
        return super().ready()