import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
ME_URL = "/api/v1/auth/me/"


@pytest.mark.django_db
def test_register_student(api_client):
    payload = {
        "email": "newstudent@example.com",
        "password": "StrongPass123!",
        "first_name": "Chidi",
        "last_name": "Okere",
        "role": "STUDENT",
    }
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["user"]["email"] == "newstudent@example.com"
    assert body["user"]["role"] == User.Role.STUDENT
    assert body["access"]
    assert body["refresh"]

    user = User.objects.get(email="newstudent@example.com")
    assert user.role == User.Role.STUDENT
    assert user.check_password("StrongPass123!")


@pytest.mark.django_db
def test_register_driver(api_client):
    payload = {
        "email": "newdriver@example.com",
        "password": "StrongPass123!",
        "role": "DRIVER",
    }
    response = api_client.post(REGISTER_URL, payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["user"]["role"] == User.Role.DRIVER


@pytest.mark.django_db
def test_register_rejects_unknown_role(api_client):
    payload = {
        "email": "weird@example.com",
        "password": "StrongPass123!",
        "role": "PILOT",
    }
    response = api_client.post(REGISTER_URL, payload, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api_client, student_user):
    payload = {
        "email": student_user.email,
        "password": "StrongPass123!",
        "role": "STUDENT",
    }
    response = api_client.post(REGISTER_URL, payload, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


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


@pytest.mark.django_db
def test_old_access_token_is_invalid_after_password_change(api_client, student_user):
    login = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "StrongPass123!"},
        format="json",
    )
    old_access = login.json()["access"]

    change_client = APIClient()
    change_client.force_authenticate(student_user)
    changed = change_client.post(
        "/api/v1/auth/change-password/",
        {"old_password": "StrongPass123!", "new_password": "NewStrongPass456!"},
        format="json",
    )
    assert changed.status_code == status.HTTP_200_OK

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert client.get(ME_URL).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_old_refresh_token_is_invalid_after_password_change(api_client, student_user):
    login = api_client.post(
        LOGIN_URL,
        {"email": student_user.email, "password": "StrongPass123!"},
        format="json",
    )
    old_refresh = login.json()["refresh"]

    change_client = APIClient()
    change_client.force_authenticate(student_user)
    change_client.post(
        "/api/v1/auth/change-password/",
        {"old_password": "StrongPass123!", "new_password": "NewStrongPass456!"},
        format="json",
    )

    refused = APIClient().post(REFRESH_URL, {"refresh": old_refresh}, format="json")
    assert refused.status_code == status.HTTP_401_UNAUTHORIZED

    refreshed_login = APIClient().post(
        LOGIN_URL,
        {"email": student_user.email, "password": "NewStrongPass456!"},
        format="json",
    )
    assert refreshed_login.status_code == status.HTTP_200_OK
    new_access = refreshed_login.json()["access"]

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")
    assert client.get(ME_URL).status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_driver_registration_creates_unverified_profile(api_client):
    from apps.drivers.models import DriverProfile

    response = api_client.post(
        REGISTER_URL,
        {
            "email": "newdriver@example.com",
            "password": "StrongPass123!",
            "role": "DRIVER",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    profile = DriverProfile.objects.get(user__email="newdriver@example.com")
    assert profile.is_verified is False
    assert profile.availability_status == DriverProfile.AvailabilityStatus.OFFLINE
