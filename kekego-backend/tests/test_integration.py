"""Cross-app integration flows driven entirely through the public HTTP API.

These exercises mirror a real student session: create a group, a second
student joins, a trip is published, a driver accepts and completes it, the
student pays (provider webhook), and everyone's state lines up at the end.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import DriverProfile
from apps.groups.models import Group
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.trips.models import Rating, Trip

GROUPS_URL = "/api/v1/groups/"
TRIPS_URL = "/api/v1/trips/"
AVAILABLE_TRIPS_URL = f"{TRIPS_URL}available/"
PAYMENTS_URL = "/api/v1/payments/"
COLLECTABLE_URL = f"{PAYMENTS_URL}collectable/"


def _client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.integration
@pytest.mark.django_db
def test_full_ride_flow_end_to_end(student_user, student_client, driver_user):
    User = get_user_model()
    second_student = User.objects.create_user(
        email="second.student@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    second_client = _client(second_student)
    driver_client = _client(driver_user)

    # 1. Student A creates a group.
    group_resp = student_client.post(
        GROUPS_URL,
        {
            "name": "Integration Group",
            "pickup_location": "Main Gate",
            "destination": "Library",
            "capacity": 4,
        },
        format="json",
    )
    assert group_resp.status_code == status.HTTP_201_CREATED
    group_id = group_resp.json()["id"]

    # 2. Three more students join; a group only dispatches once all 4 seats are
    # taken (members or buyout).
    join_resp = second_client.post(f"{GROUPS_URL}{group_id}/join/", format="json")
    assert join_resp.status_code == status.HTTP_200_OK
    for seat in (3, 4):
        rider = User.objects.create_user(
            email=f"rider{seat}@example.com",
            password="StrongPass123!",
            role=User.Role.STUDENT,
        )
        rider_client = _client(rider)
        assert rider_client.post(f"{GROUPS_URL}{group_id}/join/", format="json").status_code == status.HTTP_200_OK

    group = Group.objects.get(pk=group_id)
    assert group.member_count == 4
    assert group.is_dispatchable is True

    # 3. Student A publishes a trip for the group.
    trip_resp = student_client.post(
        TRIPS_URL,
        {
            "group": group_id,
            "pickup_location": "Main Gate",
            "destination": "Library",
            "fare": 200,
        },
        format="json",
    )
    assert trip_resp.status_code == status.HTTP_201_CREATED
    trip_id = trip_resp.json()["id"]
    assert trip_resp.json()["status"] == "PENDING"

    # 4. Driver goes online, discovers the trip, and accepts it.
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )
    available = driver_client.get(AVAILABLE_TRIPS_URL)
    assert available.status_code == status.HTTP_200_OK
    assert len(available.json()) == 1
    assert available.json()[0]["id"] == trip_id

    accept = driver_client.post(f"{TRIPS_URL}{trip_id}/accept/", format="json")
    assert accept.status_code == status.HTTP_200_OK
    assert accept.json()["status"] == "ACCEPTED"
    assert accept.json()["driver"] == driver_user.id

    # The creator is notified about the acceptance (eager Celery in tests).
    assert Notification.objects.filter(user=student_user, title="Driver accepted your trip").exists()

    # 5. Driver starts and completes the ride.
    start = driver_client.post(f"{TRIPS_URL}{trip_id}/start/", format="json")
    assert start.status_code == status.HTTP_200_OK
    assert start.json()["status"] == "IN_PROGRESS"

    complete = driver_client.post(f"{TRIPS_URL}{trip_id}/complete/", format="json")
    assert complete.status_code == status.HTTP_200_OK
    assert complete.json()["status"] == "COMPLETED"
    trip = Trip.objects.get(pk=trip_id)
    assert trip.status == Trip.Status.COMPLETED

    # 6. Student records a cash payment, which settles on the spot: there is
    #    no provider to call and no driver to confirm receipt.
    pay_resp = student_client.post(
        PAYMENTS_URL,
        {"trip": trip_id, "amount": 200, "currency": "NGN", "method": Payment.Method.CASH},
        format="json",
    )
    assert pay_resp.status_code == status.HTTP_201_CREATED
    payment_id = pay_resp.json()["id"]
    assert pay_resp.json()["status"] == "SUCCESSFUL"
    assert pay_resp.json()["awaiting_confirmation"] is False
    assert Payment.objects.get(pk=payment_id).status == Payment.Status.SUCCESSFUL

    # The fare must be settled exactly; a short payment is rejected.
    short_pay = student_client.post(
        PAYMENTS_URL,
        {"trip": trip_id, "amount": 100, "currency": "NGN", "method": Payment.Method.CASH},
        format="json",
    )
    assert short_pay.status_code == status.HTTP_400_BAD_REQUEST

    # The driver sees the collected fare, and has nothing left to confirm.
    collectable = driver_client.get(COLLECTABLE_URL)
    assert collectable.status_code == status.HTTP_200_OK
    assert [row["id"] for row in collectable.json()] == [payment_id]
    assert driver_client.post(f"{PAYMENTS_URL}{payment_id}/confirm/", format="json").status_code == 404

    # 7. A rider in the group rates the completed ride.
    rating = student_client.post(
        f"{TRIPS_URL}{trip_id}/rate/",
        {"stars": 5, "comment": "Smooth ride"},
        format="json",
    )
    assert rating.status_code == status.HTTP_200_OK, rating.content
    assert Rating.objects.get(pk=rating.json()["id"]).stars == 5

    # Re-rating the same trip updates the existing rating instead of duplicating.
    duplicate_rating = student_client.post(
        f"{TRIPS_URL}{trip_id}/rate/",
        {"stars": 4},
        format="json",
    )
    assert duplicate_rating.status_code == status.HTTP_200_OK
    assert Rating.objects.filter(trip_id=trip_id, user=student_user).count() == 1
    assert Rating.objects.get(trip_id=trip_id, user=student_user).stars == 4

    # 8. Ledger surfaces in the payments list.
    payments_list = student_client.get(PAYMENTS_URL)
    assert payments_list.status_code == status.HTTP_200_OK
    assert len(payments_list.json()) == 1
    assert payments_list.json()[0]["status"] == "SUCCESSFUL"


@pytest.mark.integration
@pytest.mark.django_db
def test_driver_cancellation_returns_student_to_available_pool(driver_user, student_user, student_client):
    driver_client = _client(driver_user)
    group = Group.objects.create(
        name="Cancel Pool",
        pickup_location="Gate",
        destination="School",
        capacity=2,
        created_by=student_user,
    )
    trip = Trip.objects.create(
        group=group,
        created_by=student_user,
        pickup_location="Gate",
        destination="School",
        fare=150,
        status=Trip.Status.PENDING,
    )
    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={"availability_status": DriverProfile.AvailabilityStatus.ONLINE},
    )
    accept = driver_client.post(f"{TRIPS_URL}{trip.id}/accept/", format="json")
    assert accept.status_code == status.HTTP_200_OK

    cancel = driver_client.post(f"{TRIPS_URL}{trip.id}/cancel/", format="json")
    assert cancel.status_code == status.HTTP_200_OK
    assert cancel.json()["status"] == "CANCELLED"

    trip.refresh_from_db()
    assert trip.status == Trip.Status.CANCELLED
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.ONLINE
    assert Notification.objects.filter(user=student_user, title="Trip cancelled").exists()
