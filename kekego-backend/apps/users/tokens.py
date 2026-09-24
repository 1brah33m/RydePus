from datetime import datetime

from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User

PASSWORD_VERSION_CLAIM = "pwv"


def _password_version(user: User) -> int | None:
    """Stable integer snapshot of when the user's password last changed."""
    if user is None or user.password_changed_at is None:
        return None
    changed_at = user.password_changed_at
    if isinstance(changed_at, datetime) and changed_at.tzinfo is None:
        changed_at = changed_at.replace(tzinfo=None)
    # Millisecond precision so password changes within the same second still
    # invalidate previously issued tokens.
    return int(changed_at.timestamp() * 1000)


def password_matches_token(user: User, token) -> bool:
    """Return True when ``token`` was issued using the user's current password.

    Tokens without the password-version claim (issued before this feature or
    before the password changed) are treated as invalid.
    """
    if not isinstance(token.get(PASSWORD_VERSION_CLAIM), int):
        return False
    return token[PASSWORD_VERSION_CLAIM] == _password_version(user)


class PasswordAwareRefreshToken(RefreshToken):
    """Refresh token that embeds the user's password version.

    When a password changes, ``password_changed_at`` is bumped, so every token
    minted before that moment stops matching and is rejected during
    authentication and refresh.
    """

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token[PASSWORD_VERSION_CLAIM] = _password_version(user)
        return token


def get_tokens_for_user(user) -> dict:
    """Return an access/refresh token pair for the given user."""
    refresh = PasswordAwareRefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }