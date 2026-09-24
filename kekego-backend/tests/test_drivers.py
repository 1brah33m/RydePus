import pytest
from rest_framework import status

from apps.drivers.models import DriverProfile
from apps.groups.models import Group
from apps.trips.models import Trip

AVAILABILITY_URL = "/api/v1/drivers/availability/"
DRIVER_ME_URL = "/api/v1/drivers/me/"


@pytest.mark.django_db
def test_driver_can_toggle_online_and_offline(driver_client, driver_user):
    online = driver_client.patch(AVAILABILITY_URL, {"availability_status": "ONLINE"}, format="json")
    assert online.status_code == status.HTTP_200_OK
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.ONLINE

    offline = driver_client.patch(AVAILABILITY_URL, {"availability_status": "OFFLINE"}, format="json")
    assert offline.status_code == status.HTTP_200_OK
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.OFFLINE


@pytest.mark.django_db
def test_driver_cannot_set_busy_manually(driver_client, driver_user):
    response = driver_client.patch(AVAILABILITY_URL, {"availability_status": "BUSY"}, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.OFFLINE


@pytest.mark.django_db
def test_availability_is_locked_during_active_trip(driver_client, driver_user, student_user):
    group = Group.objects.create(
        name="Running Trip",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status=Trip.Status.ACCEPTED,
    )
    profile = DriverProfile.objects.get(user=driver_user)
    profile.availability_status = DriverProfile.AvailabilityStatus.BUSY
    profile.save(update_fields=["availability_status"])

    response = driver_client.patch(AVAILABILITY_URL, {"availability_status": "ONLINE"}, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert (
        driver_client.patch(AVAILABILITY_URL, {"availability_status": "OFFLINE"}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert trip.driver_id == driver_user.id


@pytest.mark.django_db
def test_completing_trip_returns_driver_to_online(driver_client, driver_user, student_user):
    group = Group.objects.create(
        name="Rideable Trip",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status=Trip.Status.ACCEPTED,
    )
    profile = DriverProfile.objects.get(user=driver_user)
    profile.availability_status = DriverProfile.AvailabilityStatus.BUSY
    profile.save(update_fields=["availability_status"])

    started = driver_client.post(f"/api/v1/trips/{trip.id}/start/", format="json")
    assert started.status_code == status.HTTP_200_OK
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.BUSY

    completed = driver_client.post(f"/api/v1/trips/{trip.id}/complete/", format="json")
    assert completed.status_code == status.HTTP_200_OK
    assert completed.json()["status"] == Trip.Status.COMPLETED
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.ONLINE


@pytest.mark.django_db
def test_driver_cannot_skip_status_to_complete(driver_client, student_user):
    group = Group.objects.create(
        name="Skip Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status=Trip.Status.PENDING,
    )
    response = driver_client.post(f"/api/v1/trips/{trip.id}/complete/", format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
