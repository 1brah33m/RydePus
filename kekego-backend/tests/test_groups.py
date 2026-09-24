import threading

import pytest
from django.db import IntegrityError, connection, transaction
from rest_framework import status
from rest_framework.test import APIClient

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
def test_creator_occupies_first_seat(student_user):
    group = Group.objects.create(
        name="Seated Creator",
        pickup_location="Gate",
        destination="Hostel",
        capacity=3,
        created_by=student_user,
    )
    membership = GroupMember.objects.get(group=group, user=student_user)
    assert membership.seat == 1


@pytest.mark.django_db
def test_join_is_rejected_when_group_is_full(student_user):
    group = Group.objects.create(
        name="Full Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )
    second = User.objects.create_user(email="full1@example.com", password="StrongPass123!", role=User.Role.STUDENT)
    third = User.objects.create_user(email="full2@example.com", password="StrongPass123!", role=User.Role.STUDENT)

    client = APIClient()
    client.force_authenticate(second)
    assert client.post(f"{GROUPS_URL}{group.id}/join/", format="json").status_code == status.HTTP_200_OK

    client.force_authenticate(third)
    response = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"
    assert group.members.count() == group.capacity


@pytest.mark.django_db
def test_seat_unique_at_database_level(student_user):
    from apps.users.models import User

    group = Group.objects.create(
        name="Backstop Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=3,
        created_by=student_user,
    )
    second_user = User.objects.create_user(
        email="backstop@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            GroupMember.objects.create(group=group, user=second_user, seat=1)
    assert group.members.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_joins_never_exceed_capacity(student_user):
    """Burst joins against a nearly full group must not overfill it.

    ``select_for_update`` serializes the check on PostgreSQL; the unique
    ``(group, seat)`` constraint is a database-level backstop that also holds
    on backends where row locking is a no-op.

    Running on SQLite causes writer lock collisions between the real threads,
    so the burst is only exercised on databases with true row-level locking.
    The constraint backstop is covered by ``test_seat_unique_at_database_level``.
    """
    if connection.vendor == "sqlite":
        pytest.skip("select_for_update is a no-op on SQLite; concurrency needs a row-locking backend.")

    group = Group.objects.create(
        name="Race Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=2,
        created_by=student_user,
    )

    joiners = []
    for index in range(4):
        joiners.append(
            User.objects.create_user(
                email=f"joiner{index}@example.com",
                password="StrongPass123!",
                role=User.Role.STUDENT,
            )
        )

    results: list[int] = []
    barrier = threading.Barrier(len(joiners))

    def attempt(user):
        client = APIClient()
        client.force_authenticate(user)
        barrier.wait()
        results.append(client.post(f"{GROUPS_URL}{group.id}/join/", format="json").status_code)

    threads = [threading.Thread(target=attempt, args=(user,)) for user in joiners]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    group.refresh_from_db()
    assert group.members.count() <= group.capacity
    assert results.count(status.HTTP_200_OK) == 1
