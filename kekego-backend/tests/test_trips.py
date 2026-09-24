import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import DriverProfile
from apps.groups.models import Group, GroupMember
from apps.users.models import User

TRIPS_URL = "/api/v1/trips/"
AVAILABLE_TRIPS_URL = f"{TRIPS_URL}available/"


@pytest.mark.django_db
def test_student_can_create_trip(student_user, student_client):
    group = Group.objects.create(
        name="Bus to Faculty",
        pickup_location="Main Gate",
        destination="Faculty Block",
        capacity=5,
        created_by=student_user,
    )
    group.members.filter(user=student_user).exists()

    response = student_client.post(
        TRIPS_URL,
        {
            "group": group.id,
            "pickup_location": "Main Gate",
            "destination": "Faculty Block",
            "fare": 200,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["group"] == group.id
    assert body["pickup_location"] == "Main Gate"
    assert body["destination"] == "Faculty Block"
    assert body["status"] == "PENDING"


@pytest.mark.django_db
def test_driver_can_accept_trip(driver_user, student_user):
    group = Group.objects.create(
        name="Hostel Ride",
        pickup_location="Hostel A",
        destination="School Gate",
        capacity=3,
        created_by=student_user,
    )
    GroupMember.objects.get_or_create(group=group, user=student_user)

    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Hostel A",
        destination="School Gate",
        fare=150,
        status="PENDING",
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )

    response = client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "ACCEPTED"
    assert response.json()["driver"] == driver_user.id
    assert DriverProfile.objects.get(user=driver_user).availability_status == "BUSY"


@pytest.mark.django_db
def test_online_driver_can_discover_pending_trips(driver_user, student_user):
    group = Group.objects.create(
        name="Discoverable Ride",
        pickup_location="North Gate",
        destination="Library",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="North Gate",
        destination="Library",
        fare=120,
        status="PENDING",
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    response = client.get(AVAILABLE_TRIPS_URL)

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.json()] == [trip.id]


@pytest.mark.django_db
def test_driver_can_filter_available_trips_by_route(driver_user, student_user):
    matching_group = Group.objects.create(name="Match", pickup_location="North Gate", destination="Library", capacity=2, created_by=student_user)
    matching = matching_group.trip_set.create(created_by=student_user, pickup_location="North Gate", destination="Library", fare=120)
    other_group = Group.objects.create(name="Other", pickup_location="South Gate", destination="Library", capacity=2, created_by=student_user)
    other_group.trip_set.create(created_by=student_user, pickup_location="South Gate", destination="Library", fare=120)
    DriverProfile.objects.update_or_create(user=driver_user, defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE})
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    response = client.get(AVAILABLE_TRIPS_URL, {"pickup_location": "north gate", "destination": "library"})

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.json()] == [matching.id]


@pytest.mark.django_db
def test_offline_driver_cannot_discover_or_accept_trip(driver_user, student_user):
    group = Group.objects.create(
        name="Offline Driver Ride",
        pickup_location="East Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="East Gate",
        destination="Hostel",
        fare=100,
        status="PENDING",
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    available = client.get(AVAILABLE_TRIPS_URL)
    accepted = client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")

    assert available.status_code == status.HTTP_400_BAD_REQUEST
    assert accepted.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_trip_status_transition_is_validated(student_user, driver_user):
    group = Group.objects.create(
        name="Late Ride",
        pickup_location="Library",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    GroupMember.objects.get_or_create(group=group, user=student_user)

    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Library",
        destination="Hostel",
        fare=100,
        status="PENDING",
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    response = client.post(f"{TRIPS_URL}{trip.id}/complete/", format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_student_cannot_accept_trip(student_client, student_user):
    group = Group.objects.create(
        name="Reserved Ride",
        pickup_location="Gate",
        destination="Market",
        capacity=2,
        created_by=student_user,
    )
    GroupMember.objects.get_or_create(group=group, user=student_user)

    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Gate",
        destination="Market",
        fare=75,
        status="PENDING",
    )

    response = student_client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_student_can_cancel_own_pending_trip(student_client, student_user):
    group = Group.objects.create(
        name="Cancelable Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=80,
        status="PENDING",
    )

    response = student_client.post(f"{TRIPS_URL}{trip.id}/cancel/", format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "CANCELLED"


@pytest.mark.django_db
def test_student_cannot_cancel_an_accepted_trip(student_client, student_user, driver_user):
    group = Group.objects.create(
        name="Committed Ride",
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
        fare=80,
        status="ACCEPTED",
    )

    response = student_client.post(f"{TRIPS_URL}{trip.id}/cancel/", format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_completed_trip_participant_can_rate_once(student_client, student_user, driver_user):
    group = Group.objects.create(name="Rated Ride", pickup_location="Gate", destination="Hostel", capacity=2, created_by=student_user)
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=80,
        status="COMPLETED",
    )

    response = student_client.post(f"{TRIPS_URL}{trip.id}/rating/", {"score": 5, "comment": "Smooth ride."}, format="json")
    duplicate = student_client.post(f"{TRIPS_URL}{trip.id}/rating/", {"score": 4}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["score"] == 5
    assert duplicate.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_pending_trip_cannot_be_rated(student_client, student_user):
    group = Group.objects.create(name="Unrated Ride", pickup_location="Gate", destination="Hostel", capacity=2, created_by=student_user)
    trip = group.trip_set.create(created_by=student_user, pickup_location="Gate", destination="Hostel", fare=80)

    response = student_client.post(f"{TRIPS_URL}{trip.id}/rating/", {"score": 5}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_assigned_driver_can_cancel_accepted_trip(driver_user, student_user):
    group = Group.objects.create(name="Driver Cancel Ride", pickup_location="Gate", destination="Hostel", capacity=2, created_by=student_user)
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=80,
        status="ACCEPTED",
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.BUSY},
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    response = client.post(f"{TRIPS_URL}{trip.id}/cancel/driver/", format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "CANCELLED"
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.ONLINE


@pytest.mark.django_db
def test_driver_cannot_cancel_trip_not_assigned_to_them(student_user, driver_user):
    group = Group.objects.create(name="Other Drivers Trip", pickup_location="Gate", destination="Hostel", capacity=2, created_by=student_user)
    other_driver = User.objects.create_user(
        email="other.driver@example.com",
        password="StrongPass123!",
        role=User.Role.DRIVER,
        first_name="Tobi",
        last_name="Driver",
    )
    trip = group.trip_set.create(
        created_by=student_user,
        driver=other_driver,
        pickup_location="Gate",
        destination="Hostel",
        fare=80,
        status="ACCEPTED",
    )
    driver_client = APIClient()
    driver_client.force_authenticate(driver_user)

    response = driver_client.post(f"{TRIPS_URL}{trip.id}/cancel/driver/", format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"
