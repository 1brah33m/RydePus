import pytest
from rest_framework import status

from apps.groups.models import Group, GroupMember
from apps.trips.models import Trip
from apps.users.models import User

GROUPS_URL = "/api/v1/groups/"


@pytest.mark.django_db
def test_student_can_create_group(student_client):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Faculty Ride",
            "pickup_location": "Main Gate",
            "destination": "Faculty Block",
            "capacity": 4,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["name"] == "Faculty Ride"
    assert body["pickup_location"] == "Main Gate"
    assert body["destination"] == "Faculty Block"
    assert body["member_count"] == 1


@pytest.mark.django_db
def test_driver_cannot_create_group(driver_client):
    response = driver_client.post(
        GROUPS_URL,
        {
            "name": "Driver Group",
            "pickup_location": "Back Gate",
            "destination": "Hostel",
            "capacity": 3,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_student_can_join_group(student_user):
    group = Group.objects.create(
        name="Hostel Ride",
        pickup_location="Hostel A",
        destination="School Gate",
        capacity=3,
        created_by=student_user,
    )

    second_user = User.objects.create_user(
        email="secondstudent@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(second_user)

    response = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["member_count"] == 2


@pytest.mark.django_db
def test_member_can_leave_group(student_user):
    group = Group.objects.create(
        name="Leaveable Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=3,
        created_by=student_user,
    )
    second_user = User.objects.create_user(
        email="leave@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    GroupMember.objects.create(group=group, user=second_user)
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(second_user)

    response = client.post(f"{GROUPS_URL}{group.id}/leave/", format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["member_count"] == 1
    assert not GroupMember.objects.filter(group=group, user=second_user).exists()


@pytest.mark.django_db
def test_last_member_leaving_removes_group(student_client, student_user):
    group = Group.objects.create(
        name="Empty Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )

    response = student_client.post(f"{GROUPS_URL}{group.id}/leave/", format="json")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Group.objects.filter(pk=group.id).exists()


@pytest.mark.django_db
def test_creator_can_cancel_group_and_pending_trip(student_client, student_user):
    group = Group.objects.create(
        name="Cancelable Group",
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

    response = student_client.post(f"{GROUPS_URL}{group.id}/cancel/", format="json")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Group.objects.filter(pk=group.id).exists()
    assert not Trip.objects.filter(pk=trip.id).exists()


@pytest.mark.django_db
def test_group_leave_is_blocked_after_driver_accepts(student_user, driver_user):
    group = Group.objects.create(
        name="Committed Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    group.trip_set.create(
        created_by=student_user,
        driver=driver_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=100,
        status=Trip.Status.ACCEPTED,
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(student_user)

    response = client.post(f"{GROUPS_URL}{group.id}/leave/", format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_group_status_flips_full_when_capacity_reached(student_user):
    group = Group.objects.create(
        name="Filling Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    assert group.status == Group.Status.WAITING

    second_user = User.objects.create_user(
        email="secondfill@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(second_user)

    response = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Group.Status.FULL
    group.refresh_from_db()
    assert group.status == Group.Status.FULL


@pytest.mark.django_db
def test_group_status_returns_to_waiting_after_leave(student_user):
    group = Group.objects.create(
        name="Reopening Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    second_user = User.objects.create_user(
        email="reopen@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    GroupMember.objects.create(group=group, user=second_user)
    group.refresh_status()
    assert group.status == Group.Status.FULL

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(second_user)

    response = client.post(f"{GROUPS_URL}{group.id}/leave/", format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Group.Status.WAITING


@pytest.mark.django_db
def test_buyout_fills_remaining_seats_and_makes_group_dispatchable(student_user, student_client):
    """Paying for the empty seats puts the group in the driver queue at 4/4."""
    group = Group.objects.create(
        name="Buyout Ride",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    GroupMember.objects.create(
        group=group,
        user=User.objects.create_user(
            email="buyout-mate@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        ),
    )
    group.refresh_status()
    assert group.seats_filled == 2

    response = student_client.post(
        f"{GROUPS_URL}{group.id}/buyout/",
        {"seats": 2, "amount": 400, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["kind"] == "GROUP_BUYOUT"

    group.refresh_from_db()
    assert group.bought_seats == 2
    assert group.seats_filled == 4
    assert group.status == Group.Status.FULL
    assert group.is_dispatchable is True
    assert group.joinable is False


@pytest.mark.django_db
@pytest.mark.parametrize("seats", [0, -1, 3, 99])
def test_buyout_is_rejected_for_a_seat_count_outside_the_empty_range(
    student_user, student_client, seats
):
    """A student may take any of the empty seats, but never more than exist."""
    group = Group.objects.create(
        name="Partial Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    GroupMember.objects.create(
        group=group,
        user=User.objects.create_user(
            email="partial-buyout@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        ),
    )
    group.refresh_status()
    assert group.seats_filled == 2  # 2 empty seats available

    response = student_client.post(
        f"{GROUPS_URL}{group.id}/buyout/",
        {"seats": seats, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    group.refresh_from_db()
    assert group.bought_seats == 0
    assert group.status == Group.Status.WAITING


@pytest.mark.django_db
def test_group_becomes_full_when_the_fourth_member_joins(student_user):
    group = Group.objects.create(
        name="Fourth Seat",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    for index in range(3):
        GroupMember.objects.create(
            group=group,
            user=User.objects.create_user(
                email=f"fourth{index}@example.com",
                password="StrongPass123!",
                role=User.Role.STUDENT,
            ),
        )
    group.refresh_status()

    assert group.seats_filled == 4
    assert group.status == Group.Status.FULL
    assert group.is_dispatchable is True
    assert group.joinable is False


@pytest.mark.django_db
def test_leaving_a_full_group_cancels_its_pending_trip(student_user, student_client):
    group = Group.objects.create(
        name="Drop Out",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    for index in range(3):
        GroupMember.objects.create(
            group=group,
            user=User.objects.create_user(
                email=f"dropout{index}@example.com",
                password="StrongPass123!",
                role=User.Role.STUDENT,
            ),
        )
    group.refresh_status()
    trip = group.trip_set.create(
        created_by=student_user,
        pickup_location="Gate",
        destination="Hostel",
        fare=400,
        status=Trip.Status.PENDING,
    )

    response = student_client.post(f"{GROUPS_URL}{group.id}/leave/")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["seats_filled"] == 3
    trip.refresh_from_db()
    assert trip.status == Trip.Status.CANCELLED


@pytest.mark.django_db
def test_non_member_cannot_buyout_seats(student_user):
    group = Group.objects.create(
        name="Outsider Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    outsider = User.objects.create_user(
        email="outsider@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(outsider)

    response = client.post(
        f"{GROUPS_URL}{group.id}/buyout/",
        {"seats": 3, "amount": 600, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    group.refresh_from_db()
    assert group.bought_seats == 0


@pytest.mark.django_db
def test_group_creation_defaults_to_four_seat_capacity(student_client):
    """Every group is a 4-slot keke ride."""
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Default Capacity Ride",
            "pickup_location": "Gate",
            "destination": "Hostel",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["capacity"] == 4
    assert body["seats_filled"] == 1
    assert body["bought_seats"] == 0
    assert body["status"] == Group.Status.WAITING


@pytest.mark.django_db
@pytest.mark.parametrize("capacity", [1, 2, 3, 5])
def test_group_creation_rejects_any_capacity_but_four(student_client, capacity):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Bad Capacity Ride",
            "pickup_location": "Gate",
            "destination": "Hostel",
            "capacity": capacity,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
