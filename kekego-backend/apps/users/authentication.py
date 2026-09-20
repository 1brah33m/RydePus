"""Authentication helpers for the users app."""

from rest_framework.authentication import BaseAuthentication


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