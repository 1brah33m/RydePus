"""Authentication helpers for the users app."""

from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from apps.users.tokens import password_matches_token


class BearerHeaderAuthenticator(BaseAuthentication):
    """Advertise the ``WWW-Authenticate`` scheme without authenticating anyone.

    Used on public endpoints (login/register) so DRF emits HTTP 401 instead of
    coercing ``AuthenticationFailed`` to HTTP 403 when there are no real
    authentication classes attached to the view.
    """

    def authenticate(self, request):
        return None

    def authenticate_header(self, request) -> str:
        return "Bearer"


class PasswordAwareJWTAuthentication(JWTAuthentication):
    """JWT authentication that rejects tokens issued before a password change."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not password_matches_token(user, validated_token):
            raise AuthenticationFailed(
                "Your session has been invalidated. Please sign in again.",
                code="token_invalidated",
            )
        return user
