from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Operational app: management commands and periodic reliability tasks."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Core operations"
