"""Schema (drf-spectacular) wiring so JWT authentication shows up in the docs."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTScheme(OpenApiAuthenticationExtension):
    """Describe simplejwt Bearer tokens in the OpenAPI schema."""

    target_class = "apps.users.authentication.PasswordAwareJWTAuthentication"
    name = "BearerAuth"

    def get_security_definition(self, auto_schema) -> dict:
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
