from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

# Importing this module registers the JWT security scheme with drf-spectacular.
import config.spectacular  # noqa: F401

from config.views import HealthView

handler404 = "config.views.api_404"
handler403 = "config.views.api_403"
handler500 = "config.views.api_500"

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/drivers/", include("apps.drivers.urls")),
    path("api/v1/groups/", include("apps.groups.urls")),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    # API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]