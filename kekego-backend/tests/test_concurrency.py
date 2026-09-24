"""Concurrency and race-condition tests.

A real ``SELECT ... FOR UPDATE`` backstop only works on a row-locking backend,
so these tests carry the ``concurrency`` marker and the CI integration job runs
them against PostgreSQL. On SQLite they are skipped with an explicit reason.

``test_duplicate_join_rejected`` runs everywhere: the unique
``(group, user)`` and ``(group, seat)`` database constraints are race-proof
regardless of backend, so it guards the same invariant on SQLite.
"""

import threading

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import DriverProfile
from apps.groups.models import Group
from apps.trips.models import Trip

TRIPS_URL = "/api/v1/trips/"
GROUPS_URL = "/api/v1/groups/"

SQLITE = "sqlite" in settings.DATABASES["default"]["ENGINE"]
needs_row_locking = pytest.mark.skipif(
    SQLITE,
    reason="select_for_update is a no-op on SQLite; run with a PostgreSQL-backed suite.",
)


def _client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def _two_online_drivers(driver_user, logged_in_driver_2):
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )
    DriverProfile.objects.update_or_create(
        user=logged_in_driver_2,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )


def _pending_trip(student_user):
    group = Group.objects.create(
        name="Racial Trip",
        pickup_location="Gate",
        destination="Market",
        capacity=4,
        created_by=student_user,
    )
    return Trip.objects.create(
        group=group,
        created_by=student_user,
        pickup_location="Gate",
        destination="Market",
        fare=150,
        status=Trip.Status.PENDING,
    )


@needs_row_locking
@pytest.mark.concurrency
@pytest.mark.django_db
def test_only_one_driver_can_accept_a_trip(driver_user, student_user):
    """Two drivers race to accept the same trip; exactly one wins."""
    User = get_user_model()
    driver2 = User.objects.create_user(
        email="driver2@example.com",
        password="StrongPass123!",
        role=User.Role.DRIVER,
    )
    _two_online_drivers(driver_user, driver2)
    trip = _pending_trip(student_user)

    results: list = []
    barrier = threading.Barrier(2)

    def accept(user):
        barrier.wait()
        client = _client(user)
        response = client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")
        results.append(response.status_code)

    thread_a = threading.Thread(target=accept, args=(driver_user,))
    thread_b = threading.Thread(target=accept, args=(driver2,))
    thread_a.start()
    thread_b.start()
    thread_a.join()
    thread_b.join()

    accepted = [code for code in results if code == status.HTTP_200_OK]
    rejected = [code for code in results if code == status.HTTP_400_BAD_REQUEST]
    assert accepted == [status.HTTP_200_OK]
    assert rejected == [status.HTTP_400_BAD_REQUEST]

    trip.refresh_from_db()
    assert trip.status == Trip.Status.ACCEPTED
    assert trip.driver_id in {driver_user.id, driver2.id}
    # Whichever driver won flips to BUSY; the loser stays ONLINE.
    busy = DriverProfile.objects.filter(user__in=[driver_user.id, driver2.id], availability_status="BUSY").count()
    assert busy == 1


@needs_row_locking
@pytest.mark.concurrency
@pytest.mark.django_db
def test_concurrent_join_preserves_capacity(driver_user, student_user):
    """Many students join a small group under concurrency; capacity holds."""
    group = Group.objects.create(
        name="Race Join",
        pickup_location="Gate",
        destination="Market",
        capacity=2,
        created_by=student_user,
    )
    User = get_user_model()
    students = [
        User.objects.create_user(
            email=f"racer{i}@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        )
        for i in range(4)
    ]

    results: list = []
    barrier = threading.Barrier(len(students))

    def join(student):
        barrier.wait()
        client = _client(student)
        response = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
        results.append(response.status_code)

    threads = [threading.Thread(target=join, args=(student,)) for student in students]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    ok = sum(1 for code in results if code == status.HTTP_200_OK)
    assert ok == 2
    assert group.member_count == 2
    assert group.members.count() == 2


@pytest.mark.django_db
def test_duplicate_join_rejected(db, student_user):
    """A user cannot double-join; the unique (group, user) constraint is the backstop."""
    User = get_user_model()
    joiner = User.objects.create_user(
        email="joiner@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    group = Group.objects.create(
        name="One Member",
        pickup_location="Gate",
        destination="Market",
        capacity=4,
        created_by=student_user,
    )
    client = _client(joiner)

    first = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert first.status_code == status.HTTP_200_OK

    second = client.post(f"{GROUPS_URL}{group.id}/join/", format="json")
    assert second.status_code == status.HTTP_400_BAD_REQUEST

    assert group.members.count() == 2  # creator + joiner, no duplicates
