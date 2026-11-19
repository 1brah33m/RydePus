import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import DriverProfile
from apps.groups.models import Group, GroupMember
from apps.trips.models import Trip
from apps.trips.services import dispatch_group
from apps.users.models import User

GROUPS_URL = "/api/v1/groups/"
TRIPS_URL = "/api/v1/trips/"
AVAILABLE_TRIPS_URL = f"{TRIPS_URL}available/"


def _make_student(email: str) -> User:
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )


def _client_for(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def _group_with_members(creator: User, members: int) -> Group:
    """Create a 4-seat group pre-filled with ``members`` members (creator included)."""
    group = Group.objects.create(
        name="Campus Ride",
        pickup_location="East Gate",
        destination="Library",
        pickup_lat="6.524400",
        pickup_lng="3.379200",
        destination_lat="6.530000",
        destination_lng="3.390000",
        capacity=4,
        created_by=creator,
    )
    for index in range(members - 1):
        GroupMember.objects.create(group=group, user=_make_student(f"member{group.id}-{index}@example.com"))
    group.refresh_status()
    group.refresh_from_db()
    return group


@pytest.mark.django_db
def test_joining_last_seat_auto_dispatches_ride(student_user):
    group = _group_with_members(student_user, members=3)
    assert group.status == Group.Status.WAITING
    assert Trip.objects.filter(group=group).count() == 0

    joiner = _make_student("joiner@example.com")
    response = _client_for(joiner).post(f"{GROUPS_URL}{group.id}/join/", format="json")

    assert response.status_code == status.HTTP_200_OK
    group.refresh_from_db()
    assert group.status == Group.Status.FULL

    trip = Trip.objects.get(group=group)
    assert trip.status == Trip.Status.PENDING
    assert trip.driver_id is None
    assert trip.created_by == student_user
    assert trip.fare == group.fare_per_seat
    assert trip.pickup_location == group.pickup_location
    assert trip.destination == group.destination
    assert trip.pickup_lat == group.pickup_lat
    assert trip.destination_lat == group.destination_lat


@pytest.mark.django_db
def test_buyout_filling_remaining_seats_auto_dispatches_ride(student_user, student_client):
    group = _group_with_members(student_user, members=2)

    response = student_client.post(f"{GROUPS_URL}{group.id}/buyout/", {"seats": 2}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    group.refresh_from_db()
    assert group.status == Group.Status.FULL

    trip = Trip.objects.get(group=group)
    assert trip.status == Trip.Status.PENDING
    assert trip.fare == group.fare_per_seat


@pytest.mark.django_db
def test_group_created_with_every_seat_paid_auto_dispatches_ride(student_user, student_client):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Whole Keke",
            "pickup_location": "Main Gate",
            "destination": "Faculty Block",
            "pickup_lat": "6.524400",
            "pickup_lng": "3.379200",
            "destination_lat": "6.530000",
            "destination_lng": "3.390000",
            "seats": 4,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    group = Group.objects.get(pk=response.json()["id"])
    assert group.status == Group.Status.FULL

    trip = Trip.objects.get(group=group)
    assert trip.status == Trip.Status.PENDING
    assert trip.created_by == student_user


@pytest.mark.django_db
def test_partial_group_is_not_dispatched(student_user, student_client):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Half Full",
            "pickup_location": "Main Gate",
            "destination": "Faculty Block",
            "capacity": 4,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    group = Group.objects.get(pk=response.json()["id"])

    joiner = _make_student("second@example.com")
    joined = _client_for(joiner).post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert joined.status_code == status.HTTP_200_OK

    group.refresh_from_db()
    assert group.status == Group.Status.WAITING
    assert Trip.objects.filter(group=group).count() == 0


@pytest.mark.django_db
def test_auto_dispatched_ride_reaches_online_driver_queue(student_user, driver_user):
    group = _group_with_members(student_user, members=3)
    joiner = _make_student("joiner@example.com")
    _client_for(joiner).post(f"{GROUPS_URL}{group.id}/join/", format="json")
    trip = Trip.objects.get(group=group)

    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )
    response = _client_for(driver_user).get(AVAILABLE_TRIPS_URL)

    assert response.status_code == status.HTTP_200_OK
    assert trip.id in [item["id"] for item in response.json()]


@pytest.mark.django_db
def test_auto_dispatch_does_not_stack_a_duplicate(student_user, student_client):
    group = _group_with_members(student_user, members=3)
    joiner = _make_student("joiner@example.com")
    _client_for(joiner).post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert Trip.objects.filter(group=group).count() == 1

    # A client that still calls the manual dispatch must not stack a second trip.
    response = student_client.post(
        TRIPS_URL,
        {
            "group": group.id,
            "pickup_location": group.pickup_location,
            "destination": group.destination,
            "fare": "150.00",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Trip.objects.filter(group=group).count() == 1


@pytest.mark.django_db
def test_completed_trip_is_not_redispatched(student_user):
    group = _group_with_members(student_user, members=4)

    trip = dispatch_group(group)
    assert trip is not None

    trip.status = Trip.Status.COMPLETED
    trip.save(update_fields=["status", "updated_at"])

    assert dispatch_group(group) is None
    assert Trip.objects.filter(group=group).count() == 1


@pytest.mark.django_db
def test_reopened_group_dispatches_a_fresh_ride(student_user):
    group = _group_with_members(student_user, members=4)
    trip = dispatch_group(group)
    assert trip.status == Trip.Status.PENDING

    leaver = group.members.exclude(user=student_user).first()
    left = _client_for(leaver.user).post(f"{GROUPS_URL}{group.id}/leave/", format="json")
    assert left.status_code == status.HTTP_200_OK
    trip.refresh_from_db()
    assert trip.status == Trip.Status.CANCELLED

    refill = _make_student("refill@example.com")
    joined = _client_for(refill).post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert joined.status_code == status.HTTP_200_OK

    pending = Trip.objects.filter(group=group, status=Trip.Status.PENDING)
    assert pending.count() == 1
    assert pending.get().id != trip.id
