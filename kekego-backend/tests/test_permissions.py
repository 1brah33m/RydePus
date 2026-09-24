import pytest
from rest_framework.test import APIClient

from apps.users.models import User

DRIVER_ME_URL = "/api/v1/drivers/me/"
GROUPS_PING_URL = "/api/v1/groups/ping/"


@pytest.mark.django_db
def test_student_only_endpoint_allows_student(student_client):
    response = student_client.get(GROUPS_PING_URL)
    assert response.status_code == 200
    assert response.json()["role"] == User.Role.STUDENT


@pytest.mark.django_db
def test_student_only_endpoint_rejects_driver(driver_client):
    response = driver_client.get(GROUPS_PING_URL)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_driver_only_endpoint_allows_driver(driver_client):
    response = driver_client.get(DRIVER_ME_URL)
    assert response.status_code == 200
    assert response.json()["role"] == User.Role.DRIVER


@pytest.mark.django_db
def test_driver_only_endpoint_rejects_student(student_client):
    response = student_client.get(DRIVER_ME_URL)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_role_gated_endpoint_rejects_unauthenticated(api_client):
    response = api_client.get(DRIVER_ME_URL)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


@pytest.mark.django_db
def test_driver_profile_is_created_for_driver(driver_client, driver_user):
    response = driver_client.get(DRIVER_ME_URL)
    assert response.status_code == 200
    assert response.json()["role"] == User.Role.DRIVER
    assert response.json()["availability_status"] == "OFFLINE"
    assert response.json()["is_verified"] is True


@pytest.mark.django_db
def test_unverified_driver_cannot_use_driver_endpoints(api_client, unverified_driver_user):
    client = APIClient()
    client.force_authenticate(unverified_driver_user)

    me = client.get(DRIVER_ME_URL)
    assert me.status_code == 403
    assert me.json()["error"]["code"] == "PERMISSION_DENIED"

    availability = client.patch(
        "/api/v1/drivers/availability/",
        {"availability_status": "ONLINE"},
        format="json",
    )
    assert availability.status_code == 403


@pytest.mark.django_db
def test_driver_can_update_availability(driver_client, driver_user):
    response = driver_client.patch(
        "/api/v1/drivers/availability/",
        {"availability_status": "ONLINE"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["availability_status"] == "ONLINE"


@pytest.mark.django_db
def test_permission_classes_work_directly(driver_user):
    from apps.users.permissions import IsDriver, IsStudent
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()

    driver_request = factory.get(DRIVER_ME_URL)
    driver_request.user = driver_user

    student_request = factory.get(GROUPS_PING_URL)
    student_request.user = None

    assert IsDriver().has_permission(driver_request, None) is True
    assert IsStudent().has_permission(driver_request, None) is False