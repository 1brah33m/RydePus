import pytest
from rest_framework.test import APIClient

from apps.drivers.models import DriverProfile
from apps.users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db) -> User:
    return User.objects.create_user(
        email="student@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
        first_name="Ada",
        last_name="Student",
    )


@pytest.fixture
def driver_user(db) -> User:
    user = User.objects.create_user(
        email="driver@example.com",
        password="StrongPass123!",
        role=User.Role.DRIVER,
        first_name="Bola",
        last_name="Driver",
    )
    DriverProfile.objects.create(user=user, is_verified=True)
    return user


@pytest.fixture
def unverified_driver_user(db) -> User:
    """A DRIVER account created through public registration (never verified)."""
    return User.objects.create_user(
        email="unverified.driver@example.com",
        password="StrongPass123!",
        role=User.Role.DRIVER,
    )


@pytest.fixture
def student_client(api_client, student_user) -> APIClient:
    api_client.force_authenticate(student_user)
    return api_client


@pytest.fixture
def driver_client(api_client, driver_user) -> APIClient:
    api_client.force_authenticate(driver_user)
    return api_client
