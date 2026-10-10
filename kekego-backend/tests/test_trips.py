import pytest
from rest_framework import status

from apps.drivers.models import DriverProfile
from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.models import User

TRIPS_URL = "/api/v1/trips/"
AVAILABLE_TRIPS_URL = f"{TRIPS_URL}available/"


def _fill_group(group: Group, creator, total: int = 4) -> Group:
    """Add members until the group reaches `total` seats, then refresh its status."""
    for index in range(total - group.member_count):
        member = User.objects.create_user(
            email=f"filler{group.id}-{index}@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        )
        GroupMember.objects.create(group=group, user=member)
    group.refresh_status()
    group.refresh_from_db()
    return group


@pytest.mark.django_db
def test_student_can_create_trip_once_group_is_full(student_user, student_client):
    group = Group.objects.create(
        name="Bus to Faculty",
        pickup_location="Main Gate",
        destination="Faculty Block",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)

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
    assert body["passenger_count"] == 4
    # The whole ride is worth fare x every filled seat, not a single seat.
    assert body["fare_total"] == "800.00"
    # Each passenger is accountable for their own single seat.
    assert body["my_seats"] == 1
    assert len(body["passengers"]) == 4
    assert all(p["seats"] == 1 for p in body["passengers"])


@pytest.mark.django_db
def test_trip_reports_committed_seats_per_passenger(student_user, student_client):
    """A student who buys out empty seats is reported with that full seat count."""
    group = Group.objects.create(
        name="Committed Allocation",
        pickup_location="Main Gate",
        destination="Faculty Block",
        capacity=4,
        created_by=student_user,
        pickup_lat=6.4541,
        pickup_lng=3.3947,
        destination_lat=6.4478,
        destination_lng=3.3729,
    )
    filler = User.objects.create_user(
        email="filler-commit@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    GroupMember.objects.create(group=group, user=filler)
    group.refresh_status()

    # The creator covers the two remaining empty seats: own + 2 = 3 committed.
    buyout = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 2, "currency": "NGN"},
        format="json",
    )
    assert buyout.status_code == status.HTTP_201_CREATED

    response = student_client.post(
        TRIPS_URL,
        {
            "group": group.id,
            "pickup_location": "Gate",
            "destination": "Hostel",
            "fare": 100,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["my_seats"] == 3
    by_id = {p["id"]: p["seats"] for p in body["passengers"]}
    assert by_id[student_user.id] == 3
    assert by_id[filler.id] == 1
    assert sum(by_id.values()) == 4


@pytest.mark.django_db
@pytest.mark.parametrize("seats", [1, 2, 3])
def test_trip_cannot_be_dispatched_for_a_partial_group(student_user, student_client, seats):
    """Fewer than 4/4 passengers must never reach the driver queue."""
    group = Group.objects.create(
        name="Partial Ride",
        pickup_location="Main Gate",
        destination="Faculty Block",
        capacity=4,
        created_by=student_user,
    )
    for index in range(seats - 1):
        member = User.objects.create_user(
            email=f"partial{index}@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        )
        GroupMember.objects.create(group=group, user=member)
    group.refresh_status()

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

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Trip.objects.filter(group=group).exists()


@pytest.mark.django_db
def test_second_trip_is_rejected_for_an_already_dispatched_group(student_user, student_client):
    group = Group.objects.create(
        name="Double Dispatch",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
    payload = {
        "group": group.id,
        "pickup_location": "Gate",
        "destination": "Hostel",
        "fare": 200,
    }

    first = student_client.post(TRIPS_URL, payload, format="json")
    second = student_client.post(TRIPS_URL, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert Trip.objects.filter(group=group).count() == 1


@pytest.mark.django_db
def test_trip_is_rejected_for_a_group_that_already_completed_a_ride(
    student_user, student_client
):
    """A full group stays dispatchable after its ride, so the completed trip
    has to be what blocks a second one."""
    group = Group.objects.create(
        name="Repeat Ride",
        pickup_location="Main Gate",
        destination="Hostel Block",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
    payload = {
        "group": group.id,
        "pickup_location": "Main Gate",
        "destination": "Hostel Block",
        "fare": 200,
    }

    first = student_client.post(TRIPS_URL, payload, format="json")
    assert first.status_code == status.HTTP_201_CREATED

    trip = Trip.objects.get(group=group)
    trip.status = Trip.Status.COMPLETED
    trip.save(update_fields=["status"])

    group.refresh_from_db()
    assert group.is_dispatchable, "group should still look full after completing"

    second = student_client.post(TRIPS_URL, payload, format="json")

    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert "already completed" in str(second.json())
    assert Trip.objects.filter(group=group).count() == 1


@pytest.mark.django_db
def test_trip_can_be_created_again_after_a_cancelled_ride(student_user, student_client):
    """A cancelled ride leaves the group wanting to travel, so it may re-dispatch."""
    group = Group.objects.create(
        name="Retry Ride",
        pickup_location="Main Gate",
        destination="Hostel Block",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
    payload = {
        "group": group.id,
        "pickup_location": "Main Gate",
        "destination": "Hostel Block",
        "fare": 200,
    }

    first = student_client.post(TRIPS_URL, payload, format="json")
    assert first.status_code == status.HTTP_201_CREATED

    trip = Trip.objects.get(group=group)
    trip.status = Trip.Status.CANCELLED
    trip.save(update_fields=["status"])

    second = student_client.post(TRIPS_URL, payload, format="json")

    assert second.status_code == status.HTTP_201_CREATED
    assert Trip.objects.filter(group=group).count() == 2


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
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
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
def test_student_sees_driver_bank_details_on_an_assigned_trip(student_user, driver_user):
    """The payment card needs the driver's account to show a transfer option."""
    group = Group.objects.create(
        name="Bank Details Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=400,
        status=Trip.Status.ACCEPTED,
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={
            "bank_name": "UBA",
            "account_number": "2011123456",
            "account_name": "BOLA DRIVER",
        },
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(student_user)
    response = client.get(TRIPS_URL)

    assert response.status_code == status.HTTP_200_OK
    body = next(item for item in response.json() if item["id"] == trip.id)
    assert body["driver_bank"] == {
        "bank_name": "UBA",
        "account_number": "2011123456",
        "account_name": "BOLA DRIVER",
    }


@pytest.mark.django_db
def test_driver_bank_details_are_hidden_when_not_configured(student_user, driver_user):
    group = Group.objects.create(
        name="No Bank Details",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    _fill_group(group, student_user)
    trip = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=400,
        status=Trip.Status.ACCEPTED,
    )
    DriverProfile.objects.update_or_create(user=driver_user, defaults={})

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(student_user)
    response = client.get(TRIPS_URL)

    body = next(item for item in response.json() if item["id"] == trip.id)
    assert body["driver_bank"] is None


@pytest.mark.django_db
def test_driver_queue_hides_trips_for_groups_that_are_not_full(driver_user, student_user):
    """Even a legacy/orphaned PENDING trip stays hidden until the group is 4/4."""
    waiting_group = Group.objects.create(
        name="Waiting Ride",
        pickup_location="West Gate",
        destination="Cafeteria",
        capacity=4,
        created_by=student_user,
    )
    GroupMember.objects.create(
        group=waiting_group,
        user=User.objects.create_user(
            email="onlyone@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        ),
    )
    waiting_group.refresh_status()
    hidden = waiting_group.trip_set.create(
        created_by=student_user,
        pickup_location="West Gate",
        destination="Cafeteria",
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
    assert hidden.id not in [item["id"] for item in response.json()]


@pytest.mark.django_db
def test_driver_queue_shows_bought_out_group_even_when_status_is_stale(driver_user, student_user):
    """A buyout that filled the last seat is visible even if status was not refreshed.

    Some servers filled the group's seats without recomputing ``Group.status``,
    leaving it ``WAITING`` while all four seats were accounted for. The queue is
    derived from the real seat counts so the ride still reaches drivers.
    """
    group = Group.objects.create(
        name="Stale Status Ride",
        pickup_location="North Gate",
        destination="Library",
        capacity=4,
        created_by=student_user,
    )
    Payment.objects.create(
        group=group,
        payer=student_user,
        amount=450,
        seats=group.capacity - group.member_count,
        kind=Payment.Kind.GROUP_BUYOUT,
        status=Payment.Status.SUCCESSFUL,
    )
    # Deliberately do NOT refresh the group's status.
    assert group.status == Group.Status.WAITING
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="North Gate",
        destination="Library",
        fare=600,
        status=Trip.Status.PENDING,
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)
    response = client.get(AVAILABLE_TRIPS_URL)

    assert response.status_code == status.HTTP_200_OK
    assert trip.id in [item["id"] for item in response.json()]


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


def _online_driver_client(driver_user, student_user):
    """Build a group + pending trip and an authenticated ONLINE driver client."""
    group = Group.objects.create(
        name="Flow Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    drift = group.trip_set.create(
        created_by=student_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status="PENDING",
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)
    return client, drift


@pytest.mark.django_db
def test_driver_completes_trip_and_returns_online(student_user, driver_user):
    client, trip = _online_driver_client(driver_user, student_user)

    accept = client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")
    assert accept.status_code == status.HTTP_200_OK
    start = client.post(f"{TRIPS_URL}{trip.id}/start/", format="json")
    assert start.status_code == status.HTTP_200_OK
    assert start.json()["started_at"]
    complete = client.post(f"{TRIPS_URL}{trip.id}/complete/", format="json")
    assert complete.status_code == status.HTTP_200_OK
    body = complete.json()
    assert body["status"] == "COMPLETED"
    assert body["completed_at"]
    assert DriverProfile.objects.get(user=driver_user).availability_status == "ONLINE"


@pytest.mark.django_db
def test_trip_serializer_includes_passenger_and_driver_details(student_user, driver_user):
    group = Group.objects.create(
        name="Rich Ride",
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
        status="ACCEPTED",
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(student_user)

    response = client.get(TRIPS_URL)
    assert response.status_code == status.HTTP_200_OK
    body = response.json()[0]
    assert body["passenger_count"] == 1
    # fare_total follows the seats actually filled, not the keke's capacity.
    assert body["fare_total"] == "100.00"
    assert body["driver_name"] == driver_user.full_name
    assert body["driver_phone"] == ""
    assert body["created_by_name"] == student_user.full_name
    assert body["my_rating"] is None


@pytest.mark.django_db
def test_driver_assigned_endpoint_lists_only_active_rides(student_user, driver_user):
    group = Group.objects.create(
        name="Active Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    active = group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status="IN_PROGRESS",
    )
    group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status="COMPLETED",
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(driver_user)

    assigned = client.get(f"{TRIPS_URL}assigned/")
    history = client.get(f"{TRIPS_URL}history/")

    assert assigned.status_code == status.HTTP_200_OK
    assert [item["id"] for item in assigned.json()] == [active.id]
    assert history.status_code == status.HTTP_200_OK
    assert len(history.json()) == 1


@pytest.mark.django_db
def test_student_can_rate_a_completed_trip(student_user, student_client, driver_user):
    group = Group.objects.create(
        name="Ratable Ride",
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
        status="COMPLETED",
    )

    response = student_client.post(
        f"{TRIPS_URL}{trip.id}/rate/",
        {"stars": 5, "comment": "Smooth ride"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["stars"] == 5

    listing = student_client.get(TRIPS_URL)
    assert listing.json()[0]["my_rating"] == 5


@pytest.mark.django_db
def test_student_cannot_rate_a_pending_trip(student_client, student_user):
    group = Group.objects.create(
        name="Not Done Ride",
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
        status="PENDING",
    )

    response = student_client.post(
        f"{TRIPS_URL}{trip.id}/rate/",
        {"stars": 5},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"
