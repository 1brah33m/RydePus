import json
import time

import jwt
import pytest
from django.conf import settings
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
ME_URL = "/api/v1/auth/me/"
GOOGLE_IDENTITY_URL = "/api/v1/auth/google/identity/"

VALID_PASSWORD = "StrongPass123!"


def register_payload(**overrides) -> dict:
    """A complete, valid registration body; override single fields per test."""
    payload = {
        "email": "newstudent@example.com",
        "password": VALID_PASSWORD,
        "confirm_password": VALID_PASSWORD,
        "first_name": "Chidi",
        "last_name": "Okere",
        "role": "STUDENT",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_register_student(api_client):
    response = api_client.post(REGISTER_URL, register_payload(), format="json")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["user"]["email"] == "newstudent@example.com"
    assert body["user"]["role"] == User.Role.STUDENT
    assert body["user"]["first_name"] == "Chidi"
    assert body["user"]["last_name"] == "Okere"
    assert body["user"]["registration_source"] == User.RegistrationSource.MANUAL
    assert body["access"]
    assert body["refresh"]

    user = User.objects.get(email="newstudent@example.com")
    assert user.role == User.Role.STUDENT
    assert user.check_password(VALID_PASSWORD)
    assert user.google_sub is None


@pytest.mark.django_db
def test_register_driver(api_client):
    payload = register_payload(email="newdriver@example.com", role="DRIVER")
    response = api_client.post(REGISTER_URL, payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["user"]["role"] == User.Role.DRIVER


@pytest.mark.django_db
def test_register_rejects_unknown_role(api_client):
    response = api_client.post(REGISTER_URL, register_payload(role="PILOT"), format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_register_cannot_self_assign_staff_or_superuser(api_client):
    """Registration ignores privileged flags: users can never bootstrap staff access."""
    payload = register_payload(
        email="crypto@example.com",
        role="DRIVER",
        is_staff=True,
        is_superuser=True,
        is_active=False,  # even deactivation is ignored
    )
    response = api_client.post(REGISTER_URL, payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED

    user = User.objects.get(email="crypto@example.com")
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.is_active is True


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api_client, student_user):
    response = api_client.post(REGISTER_URL, register_payload(email=student_user.email), format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Password rules
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_register_requires_a_password(api_client):
    """A missing password is rejected outright rather than defaulted."""
    payload = register_payload()
    payload.pop("password")
    payload.pop("confirm_password")

    response = api_client.post(REGISTER_URL, payload, format="json")

    # The shared error envelope reports one flattened message, so the meaningful
    # check here is that nothing was created.
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not User.objects.filter(email="newstudent@example.com").exists()


@pytest.mark.django_db
def test_register_requires_password_confirmation(api_client):
    payload = register_payload()
    payload.pop("confirm_password")

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not User.objects.filter(email="newstudent@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_mismatched_password_confirmation(api_client):
    response = api_client.post(
        REGISTER_URL,
        register_payload(confirm_password="SomethingElse456!"),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "do not match" in response.json()["error"]["message"].lower()
    assert not User.objects.filter(email="newstudent@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_weak_password(api_client):
    response = api_client.post(REGISTER_URL, register_payload(password="123", confirm_password="123"), format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_register_rejects_password_below_the_minimum_length(api_client):
    too_short = "a" * (settings.PASSWORD_MIN_LENGTH - 1)
    response = api_client.post(
        REGISTER_URL,
        register_payload(password=too_short, confirm_password=too_short),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert str(settings.PASSWORD_MIN_LENGTH) in response.json()["error"]["message"]
    assert not User.objects.filter(email="newstudent@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_a_common_password(api_client):
    common = "password123"
    if len(common) < settings.PASSWORD_MIN_LENGTH:
        common = common + "abc"
    response = api_client.post(
        REGISTER_URL,
        register_payload(password=common, confirm_password=common),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "password" in response.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_register_rejects_password_too_similar_to_the_users_name(api_client):
    similar = "Chidinnechukw"
    response = api_client.post(
        REGISTER_URL,
        register_payload(
            first_name="Chidinnechukwu",
            last_name="Okere",
            password=similar,
            confirm_password=similar,
        ),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "similar" in response.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_register_does_not_trim_or_echo_the_password(api_client):
    """A password is stored verbatim; surrounding spaces are part of the secret."""
    padded = "  " + VALID_PASSWORD + "  "
    response = api_client.post(
        REGISTER_URL,
        register_payload(password=padded, confirm_password=padded),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert "password" not in response.json()["user"]
    user = User.objects.get(email="newstudent@example.com")
    assert user.check_password(padded)
    assert not user.check_password(VALID_PASSWORD)


# ---------------------------------------------------------------------------
# Name rules
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_register_requires_a_first_name(api_client):
    response = api_client.post(REGISTER_URL, register_payload(first_name=""), format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "first name" in response.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_register_requires_a_last_name(api_client):
    response = api_client.post(REGISTER_URL, register_payload(last_name="   "), format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "last name" in response.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_register_normalises_and_collapses_names(api_client):
    response = api_client.post(
        REGISTER_URL,
        register_payload(first_name="  Chidi   Nnaemeka ", last_name="Okere  Uche"),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()["user"]
    assert body["first_name"] == "Chidi Nnaemeka"
    assert body["last_name"] == "Okere Uche"


# ---------------------------------------------------------------------------
# Google-linked registration
# ---------------------------------------------------------------------------

GOOGLE_IDENTITY = {
    "email": "ada@gmail.com",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "google_sub": "1234567890",
}


@pytest.fixture
def verified_google(monkeypatch):
    """Stand in for a verified Google ID token; no network involved."""

    def _resolve(id_token: str) -> dict:
        assert id_token == "fake-id-token"
        return dict(GOOGLE_IDENTITY)

    monkeypatch.setattr("apps.users.serializers.resolve_google_identity", _resolve)
    return _resolve


@pytest.mark.django_db
def test_register_with_google_fills_the_name_from_the_token(api_client, verified_google):
    payload = register_payload(
        email=GOOGLE_IDENTITY["email"],
        first_name="",
        last_name="",
        google_id_token="fake-id-token",
    )

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()["user"]
    assert body["first_name"] == "Ada"
    assert body["last_name"] == "Lovelace"
    assert body["registration_source"] == User.RegistrationSource.GOOGLE

    user = User.objects.get(email=GOOGLE_IDENTITY["email"])
    assert user.google_sub == GOOGLE_IDENTITY["google_sub"]
    assert user.check_password(VALID_PASSWORD)


@pytest.mark.django_db
def test_google_token_overrides_a_name_the_client_typed(api_client, verified_google):
    """The verified profile wins, so a client cannot claim someone else's name."""
    payload = register_payload(
        email=GOOGLE_IDENTITY["email"],
        first_name="Someone",
        last_name="Else",
        google_id_token="fake-id-token",
    )

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()["user"]
    assert body["first_name"] == "Ada"
    assert body["last_name"] == "Lovelace"


@pytest.mark.django_db
def test_register_rejects_a_google_token_for_a_different_email(api_client, verified_google):
    payload = register_payload(email="someone-else@example.com", google_id_token="fake-id-token")

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "email" in response.json()["error"]["message"]


@pytest.mark.django_db
def test_register_rejects_an_unverifiable_google_token(api_client, monkeypatch):
    from apps.users.google import GoogleIdentityError

    def _boom(id_token: str) -> dict:
        raise GoogleIdentityError("That Google sign-in could not be verified.")

    monkeypatch.setattr("apps.users.serializers.resolve_google_identity", _boom)

    payload = register_payload(
        email=GOOGLE_IDENTITY["email"],
        first_name="",
        last_name="",
        google_id_token="forged-token",
    )
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in response.json()["error"]["message"].lower()
    assert not User.objects.filter(email=GOOGLE_IDENTITY["email"]).exists()


@pytest.mark.django_db
def test_one_google_account_cannot_be_linked_to_two_users():
    """The link is unique at the database level, not just in the serializer.

    The public endpoint cannot reach this case twice over (the email is unique
    and must match the token), so the guarantee is asserted where it lives.
    """
    from django.db import IntegrityError, transaction

    User.objects.create_user(
        email=GOOGLE_IDENTITY["email"],
        password=VALID_PASSWORD,
        registration_source=User.RegistrationSource.GOOGLE,
        google_sub=GOOGLE_IDENTITY["google_sub"],
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            User.objects.create_user(
                email="other@example.com",
                password=VALID_PASSWORD,
                registration_source=User.RegistrationSource.GOOGLE,
                google_sub=GOOGLE_IDENTITY["google_sub"],
            )


@pytest.mark.django_db
def test_google_sign_up_still_requires_a_confirmed_password(api_client, verified_google):
    """Google supplies the name, never the password."""
    payload = register_payload(
        email=GOOGLE_IDENTITY["email"],
        confirm_password="DifferentPass456!",
        google_id_token="fake-id-token",
    )

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "do not match" in response.json()["error"]["message"].lower()


# ---------------------------------------------------------------------------
# Google ID token signature verification (real RSA, no network)
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = "1234567890-abc.apps.googleusercontent.com"


def _rsa_keypair_and_jwks() -> tuple:
    """Generate a throwaway RSA key and the matching Google-style JWKS entry."""
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key())
    )
    jwk["kid"] = "test-key-id"
    jwk["alg"] = "RS256"
    jwk["use"] = "sig"
    return private_key, {"keys": [jwk]}


def _signed_google_token(private_key, **claim_overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": GOOGLE_CLIENT_ID,
        "sub": "google-sub-123",
        "email": "ada@gmail.com",
        "email_verified": True,
        "given_name": "Ada",
        "family_name": "Lovelace",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(claim_overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key-id"})


@pytest.fixture
def google_keys(monkeypatch):
    """Serve a locally generated JWKS in place of a call to Google."""
    from apps.users import google as google_module

    private_key, jwks = _rsa_keypair_and_jwks()
    monkeypatch.setattr(google_module, "_fetch_jwks", lambda: jwks["keys"])
    return private_key


@pytest.fixture
def jwks_cache_reset():
    """Keep the module-level JWKS cache from leaking between tests."""
    from apps.users import google as google_module

    google_module._jwks_cache.update({"keys": None, "fetched_at": 0.0})
    yield
    google_module._jwks_cache.update({"keys": None, "fetched_at": 0.0})


def test_verify_google_id_token_accepts_a_genuine_signature(google_keys, jwks_cache_reset):
    """The happy path of the real crypto flow, exercised without the network."""
    from apps.users.google import resolve_google_identity

    token = _signed_google_token(google_keys)

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        identity = resolve_google_identity(token)

    assert identity == {
        "email": "ada@gmail.com",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "google_sub": "google-sub-123",
    }


def test_verify_google_id_token_rejects_a_tampered_payload(google_keys, jwks_cache_reset):
    """A client cannot edit the name inside a token it already owns."""
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    token = _signed_google_token(google_keys)
    header, payload, signature = token.split(".")
    claims = json.loads(jwt.utils.base64url_decode(payload + "=" * (-len(payload) % 4)))
    claims["given_name"] = "Mallory"
    forged_payload = jwt.utils.base64url_encode(
        json.dumps(claims).encode("utf-8")
    ).decode("utf-8")

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(f"{header}.{forged_payload}.{signature}")


def test_verify_google_id_token_rejects_another_clients_audience(google_keys, jwks_cache_reset):
    """A token minted for a different app must not be accepted here."""
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    token = _signed_google_token(google_keys, aud="9999999999-other.apps.googleusercontent.com")

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(token)


def test_verify_google_id_token_rejects_an_expired_token(google_keys, jwks_cache_reset):
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    now = int(time.time())
    token = _signed_google_token(google_keys, iat=now - 7200, exp=now - 3600)

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(token)


def test_verify_google_id_token_rejects_a_non_google_issuer(google_keys, jwks_cache_reset):
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    token = _signed_google_token(google_keys, iss="https://evil.example.com")

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(token)


def test_verify_google_id_token_rejects_an_unsigned_token(google_keys, jwks_cache_reset):
    """The classic `alg: none` downgrade must never verify."""
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    now = int(time.time())
    unsigned = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": GOOGLE_CLIENT_ID,
            "sub": "google-sub-123",
            "email": "mallory@gmail.com",
            "email_verified": True,
            "iat": now,
            "exp": now + 3600,
        },
        key="",
        algorithm="none",
    )

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(unsigned)


def test_verify_google_id_token_rejects_a_token_from_an_unknown_key(google_keys, jwks_cache_reset):
    """A self-signed key whose id is not in Google's JWKS is worthless."""
    from apps.users.google import GoogleIdentityError, resolve_google_identity

    other_private_key, _ = _rsa_keypair_and_jwks()
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": GOOGLE_CLIENT_ID,
            "sub": "google-sub-123",
            "email": "mallory@gmail.com",
            "email_verified": True,
            "iat": now,
            "exp": now + 3600,
        },
        other_private_key,
        algorithm="RS256",
        headers={"kid": "attacker-key-id"},
    )

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        with pytest.raises(GoogleIdentityError):
            resolve_google_identity(token)


@pytest.mark.django_db
def test_register_with_a_genuine_google_token(api_client, google_keys, jwks_cache_reset):
    """End to end through the real verification path, not a stubbed resolver."""
    token = _signed_google_token(google_keys)

    with override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID):
        response = api_client.post(
            REGISTER_URL,
            register_payload(email="ada@gmail.com", google_id_token=token),
            format="json",
        )

    assert response.status_code == status.HTTP_201_CREATED
    user = User.objects.get(email="ada@gmail.com")
    assert user.registration_source == User.RegistrationSource.GOOGLE
    assert user.google_sub == "google-sub-123"
    assert (user.first_name, user.last_name) == ("Ada", "Lovelace")


# ---------------------------------------------------------------------------
# Google identity endpoint
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_google_identity_returns_only_the_name_and_email(api_client, monkeypatch):
    """The endpoint hands back the three fields the form needs, nothing more."""
    monkeypatch.setattr(
        "apps.users.views.resolve_google_identity",
        lambda id_token: dict(GOOGLE_IDENTITY),
    )

    response = api_client.post(GOOGLE_IDENTITY_URL, {"id_token": "fake-id-token"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "email": "ada@gmail.com",
        "first_name": "Ada",
        "last_name": "Lovelace",
    }


@pytest.mark.django_db
def test_google_identity_reports_a_missing_token(api_client):
    response = api_client.post(GOOGLE_IDENTITY_URL, {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@override_settings(GOOGLE_OAUTH_CLIENT_ID="")
def test_google_identity_is_disabled_when_unconfigured(api_client):
    from apps.users.google import verify_google_id_token

    with pytest.raises(Exception) as excinfo:
        verify_google_id_token("anything")
    assert "not configured" in str(excinfo.value)


# ---------------------------------------------------------------------------
# Google profile extraction (unit level)
# ---------------------------------------------------------------------------

def test_extract_google_names_reads_only_first_and_last_name():
    from apps.users.google import extract_google_names

    name = extract_google_names(
        {
            "given_name": "  Ada   Byron ",
            "family_name": "  Lovelace ",
            # Everything below must be ignored.
            "email": "ada@gmail.com",
            "picture": "https://lh3.google.com/a/secret.jpg",
            "locale": "en-GB",
            "birthday": "1815-12-10",
            "sub": "1234567890",
        }
    )

    assert name.first_name == "Ada Byron"
    assert name.last_name == "Lovelace"


def test_extract_google_names_tolerates_a_missing_family_name():
    from apps.users.google import extract_google_names

    name = extract_google_names({"given_name": "Cher"})

    assert name.first_name == "Cher"
    assert name.last_name == ""


def test_extract_google_names_ignores_non_string_claims():
    from apps.users.google import extract_google_names

    name = extract_google_names({"given_name": 42, "family_name": None})

    assert name.first_name == ""
    assert name.last_name == ""


def test_extract_google_names_caps_absurdly_long_values():
    from apps.users.google import extract_google_names

    name = extract_google_names({"given_name": "a" * 400, "family_name": "b" * 400})

    assert len(name.first_name) == 150
    assert len(name.last_name) == 150


@pytest.mark.django_db
def test_google_identity_rejects_an_unverified_email(api_client, monkeypatch):
    from apps.users import google as google_module

    monkeypatch.setattr(
        google_module,
        "verify_google_id_token",
        lambda token: {"email": "ada@gmail.com", "email_verified": False, "sub": "1"},
    )

    response = api_client.post(GOOGLE_IDENTITY_URL, {"id_token": "token"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "verified" in response.json()["error"]["message"]


@pytest.mark.django_db
def test_google_identity_enforces_an_allowed_email_domain(api_client, monkeypatch):
    from apps.users import google as google_module

    monkeypatch.setattr(
        google_module,
        "verify_google_id_token",
        lambda token: {
            "email": "ada@gmail.com",
            "email_verified": True,
            "given_name": "Ada",
            "family_name": "Lovelace",
            "sub": "1",
        },
    )

    with override_settings(GOOGLE_ALLOWED_EMAIL_DOMAIN="campus.edu.ng"):
        response = api_client.post(GOOGLE_IDENTITY_URL, {"id_token": "token"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "campus.edu.ng" in response.json()["error"]["message"]


@pytest.mark.django_db
def test_google_identity_accepts_an_allowed_email_domain(api_client, monkeypatch):
    from apps.users import google as google_module

    monkeypatch.setattr(
        google_module,
        "verify_google_id_token",
        lambda token: {
            "email": "ada@campus.edu.ng",
            "email_verified": True,
            "given_name": "Ada",
            "family_name": "Lovelace",
            "sub": "1",
        },
    )

    with override_settings(GOOGLE_ALLOWED_EMAIL_DOMAIN="campus.edu.ng"):
        response = api_client.post(GOOGLE_IDENTITY_URL, {"id_token": "token"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["first_name"] == "Ada"


@pytest.mark.django_db
def test_login_success(api_client, student_user):
    response = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "StrongPass123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["user"]["email"] == student_user.email
    assert body["user"]["role"] == User.Role.STUDENT
    assert body["access"]
    assert body["refresh"]


@pytest.mark.django_db
def test_login_invalid_credentials(api_client, student_user):
    response = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "wrong-password"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.django_db
def test_login_unknown_email_fails(api_client):
    response = api_client.post(
        LOGIN_URL,
        {"email": "nobody@example.com", "password": "StrongPass123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.django_db
def test_refresh_with_junk_token_rejected(api_client):
    response = api_client.post(REFRESH_URL, {"refresh": "not-a-token"}, format="json")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] in ("INVALID", "TOKEN_NOT_VALID")


@pytest.mark.django_db
def test_refresh_token_returns_new_access_token(api_client, student_user):
    login = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "StrongPass123!"},
        format="json",
    )
    refresh = login.json()["refresh"]

    response = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["access"]


@pytest.mark.django_db
def test_me_returns_current_user(student_client):
    response = student_client.get(ME_URL)
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["email"] == "student@example.com"
    assert body["role"] == User.Role.STUDENT


@pytest.mark.django_db
def test_me_updates_profile(student_client):
    response = student_client.patch(
        ME_URL,
        {"first_name": "Ada", "last_name": "Updated", "phone_number": "+2348000000000"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["first_name"] == "Ada"
    assert body["last_name"] == "Updated"
    assert body["phone_number"] == "+2348000000000"


@pytest.mark.django_db
def test_me_patch_cannot_change_role(student_client, student_user):
    """Any attempt to escalate the role through the profile endpoint is ignored."""
    response = student_client.patch(ME_URL, {"role": "DRIVER"}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["role"] == User.Role.STUDENT

    student_user.refresh_from_db()
    assert student_user.role == User.Role.STUDENT


@pytest.mark.django_db
def test_me_patch_ignores_staff_superuser_flags(student_client, student_user):
    response = student_client.patch(
        ME_URL,
        {"is_staff": True, "is_superuser": True},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    student_user.refresh_from_db()
    assert student_user.is_staff is False
    assert student_user.is_superuser is False


@pytest.mark.django_db
def test_change_password_success(student_client, student_user):
    response = student_client.post(
        "/api/v1/auth/change-password/",
        {"old_password": "StrongPass123!", "new_password": "NewStrongPass456!"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    student_user.refresh_from_db()
    assert student_user.check_password("NewStrongPass456!")


@pytest.mark.django_db
def test_change_password_rejects_wrong_old_password(student_client):
    response = student_client.post(
        "/api/v1/auth/change-password/",
        {"old_password": "wrong-password", "new_password": "NewStrongPass456!"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_me_requires_authentication(api_client):
    response = api_client.get(ME_URL)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


@pytest.mark.django_db
def test_access_token_authenticates_api_call(api_client, student_user):
    login = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "StrongPass123!"},
        format="json",
    )
    access = login.json()["access"]

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = client.get(ME_URL)
    assert response.status_code == status.HTTP_200_OK