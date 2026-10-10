import pytest
from rest_framework import status

from apps.drivers.models import DriverProfile
from apps.groups.models import Group
from apps.trips.models import Rating, Trip

DRIVER_ME_URL = "/api/v1/drivers/me/"
DRIVER_PAYOUT_URL = "/api/v1/drivers/payout/"


@pytest.mark.django_db
def test_driver_profile_starts_without_payout_details(driver_client):
    response = driver_client.get(DRIVER_ME_URL)

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["bank_name"] == ""
    assert body["account_number"] == ""
    assert body["account_name"] == ""
    assert body["has_payout_details"] is False


@pytest.mark.django_db
def test_driver_profile_has_no_rating_until_rated(driver_client):
    """A brand-new driver renders a clean fallback, not a missing field."""
    response = driver_client.get(DRIVER_ME_URL)

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["rating"] is None
    assert body["rating_count"] == 0


@pytest.mark.django_db
def test_driver_profile_averages_ratings_across_trips(driver_client, driver_user, student_user):
    group = Group.objects.create(
        name="Rated Ride",
        pickup_location="Hostel",
        destination="Market",
        capacity=4,
        created_by=student_user,
    )
    trip = Trip.objects.create(
        group=group,
        created_by=student_user,
        driver=driver_user,
        pickup_location=group.pickup_location,
        destination=group.destination,
        fare=250,
        status=Trip.Status.COMPLETED,
    )
    Rating.objects.create(trip=trip, user=student_user, stars=4)

    body = driver_client.get(DRIVER_ME_URL).json()
    assert body["rating"] == 4.0
    assert body["rating_count"] == 1


@pytest.mark.django_db
def test_driver_can_save_payout_details(driver_client):
    response = driver_client.patch(
        DRIVER_PAYOUT_URL,
        {"bank_name": "GTBank", "account_number": "0123456789", "account_name": "BOLA DRIVER"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["bank_name"] == "GTBank"
    assert body["account_number"] == "0123456789"
    assert body["account_name"] == "BOLA DRIVER"
    assert body["has_payout_details"] is True


@pytest.mark.django_db
def test_payout_details_require_all_three_fields(driver_client, driver_user):
    """A half-filled account would leave students unable to pay by transfer."""
    response = driver_client.patch(
        DRIVER_PAYOUT_URL,
        {"bank_name": "GTBank", "account_number": "0123456789"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    profile = DriverProfile.objects.get(user=driver_user)
    assert profile.has_payout_details is False


@pytest.mark.django_db
def test_payout_rejects_short_account_number(driver_client):
    response = driver_client.patch(
        DRIVER_PAYOUT_URL,
        {"bank_name": "GTBank", "account_number": "12345", "account_name": "BOLA DRIVER"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_account_number_is_normalised_to_digits(driver_client):
    response = driver_client.patch(
        DRIVER_PAYOUT_URL,
        {"bank_name": "GTBank", "account_number": "0123 4567 89", "account_name": "BOLA DRIVER"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["account_number"] == "0123456789"


@pytest.mark.django_db
def test_student_cannot_change_driver_payout_details(student_client):
    response = student_client.patch(
        DRIVER_PAYOUT_URL,
        {"bank_name": "Scam Bank", "account_number": "9999999999", "account_name": "NOBODY"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
