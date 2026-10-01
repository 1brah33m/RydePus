"""Server-side Google identity verification for sign-up.

Google sign-in is used for one thing only: proving who the person is so their
first and last name can be filled in automatically. Everything else about the
Google profile (photo, locale, birthday, profile id, ...) is deliberately
discarded — :func:`extract_google_names` is a whitelist, not a passthrough.

Trust model
-----------
The browser obtains a Google ID token and hands it to us. We never trust its
contents: the token signature is checked against Google's published JWKS, the
``aud`` claim must equal our own client ID, the issuer must be Google, and the
expiry is verified. A client therefore cannot assert a name it does not own.

Only the ID token is used, so no Google client secret is needed or stored.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

import jwt
from django.conf import settings

#: Google's public signing keys. Safe to fetch anonymously; cached briefly.
_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_JWKS_TTL_SECONDS = 60 * 60
_JWKS_TIMEOUT_SECONDS = 5

#: Both accepted values of the ``iss`` claim.
_GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

#: Longest name we will store, matching ``User.first_name``/``last_name``.
_MAX_NAME_LENGTH = 150

_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}


class GoogleIdentityError(Exception):
    """A Google ID token could not be trusted, or Google is not configured."""


@dataclass(frozen=True)
class GoogleName:
    """The only profile data we take from Google."""

    first_name: str
    last_name: str


def _clean_name(value: Any) -> str:
    """Normalise a name claim: str, collapsed whitespace, length-capped."""
    if not isinstance(value, str):
        return ""
    collapsed = " ".join(value.split())
    return collapsed[:_MAX_NAME_LENGTH]


def extract_google_names(profile: dict[str, Any]) -> GoogleName:
    """Pull first and last name out of a Google profile/claims payload.

    Reads ``given_name`` and ``family_name`` and nothing else. Google accounts
    often have no ``family_name`` at all, so an empty last name is a valid,
    non-error result — the registration form asks the user to complete it.
    """
    return GoogleName(
        first_name=_clean_name(profile.get("given_name")),
        last_name=_clean_name(profile.get("family_name")),
    )


def _fetch_jwks() -> dict[str, Any]:
    """Return Google's signing keys, cached for an hour."""
    now = time.monotonic()
    cached = _jwks_cache.get("keys")
    if cached is not None and now - float(_jwks_cache["fetched_at"]) < _JWKS_TTL_SECONDS:
        return cached

    try:
        request = urllib.request.Request(
            _JWKS_URL,
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=_JWKS_TIMEOUT_SECONDS) as response:  # noqa: S310
            keys = json.loads(response.read().decode("utf-8")).get("keys")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise GoogleIdentityError("Could not reach Google to verify your account.") from exc

    if not isinstance(keys, list) or not keys:
        raise GoogleIdentityError("Google returned no signing keys.")

    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


def _signing_key_for(token: str) -> Any:
    """Resolve the RSA public key that signed this token."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise GoogleIdentityError("That Google sign-in token is malformed.") from exc

    if header.get("alg") != "RS256":
        raise GoogleIdentityError("Unsupported Google token algorithm.")

    kid = header.get("kid")
    if not kid:
        raise GoogleIdentityError("Google token is missing a key id.")

    for key in _fetch_jwks():
        if key.get("kid") == kid:
            try:
                return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
            except (ValueError, jwt.PyJWTError) as exc:
                raise GoogleIdentityError("Google signing key could not be read.") from exc

    raise GoogleIdentityError("Google signing key is not recognised.")


def verify_google_id_token(id_token: str) -> dict[str, Any]:
    """Verify a Google ID token and return its claims.

    Raises :class:`GoogleIdentityError` when Google sign-in is not configured
    or the token fails any check. Never returns unverified claims.
    """
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    if not client_id:
        raise GoogleIdentityError("Google sign-in is not configured on this server.")

    if not id_token or not isinstance(id_token, str):
        raise GoogleIdentityError("A Google sign-in token is required.")

    key = _signing_key_for(id_token)
    try:
        return jwt.decode(
            id_token,
            key=key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=list(_GOOGLE_ISSUERS),
            options={"require": ["exp", "iat", "iss", "aud", "sub", "email"]},
        )
    except jwt.PyJWTError as exc:
        raise GoogleIdentityError("That Google sign-in could not be verified.") from exc


def resolve_google_identity(id_token: str) -> dict[str, str]:
    """Verify a token and reduce it to the fields registration is allowed to use.

    Returns ``email``, ``first_name``, ``last_name`` and ``google_sub``. The
    caller never sees the rest of the Google profile.
    """
    claims = verify_google_id_token(id_token)

    if claims.get("email_verified") is not True:
        raise GoogleIdentityError("Your Google email address is not verified.")

    email = _clean_name(claims.get("email")).lower()
    if not email:
        raise GoogleIdentityError("Your Google account did not include an email address.")

    allowed_domain = getattr(settings, "GOOGLE_ALLOWED_EMAIL_DOMAIN", "") or ""
    if allowed_domain and not email.endswith("@" + allowed_domain.lower()):
        raise GoogleIdentityError(f"Please use your @{allowed_domain} Google account.")

    name = extract_google_names(claims)
    return {
        "email": email,
        "first_name": name.first_name,
        "last_name": name.last_name,
        "google_sub": _clean_name(claims.get("sub"))[:255],
    }
