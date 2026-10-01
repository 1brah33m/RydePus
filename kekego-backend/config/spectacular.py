"""Schema (drf-spectacular) wiring so JWT authentication shows up in the docs."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTScheme(OpenApiAuthenticationExtension):
    """Describe simplejwt Bearer tokens in the OpenAPI schema."""

    target_class = "rest_framework_simplejwt.authentication.JWTAuthentication"
    name = "BearerAuth"

    def get_security_definition(self, auto_schema) -> dict:
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}


class PublicScheme(OpenApiAuthenticationExtension):
    """Mark public endpoints (login/register) as having no auth at all."""

    target_class = "apps.users.authentication.BearerHeaderAuthenticator"
    name = "noneAuth"

    def get_security_definition(self, auto_schema) -> dict:
        return {}