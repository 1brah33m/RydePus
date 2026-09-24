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
from apps.trips.models import Trip, TripRating

GROUPS_URL = "/api/v1/groups/"
TRIPS_URL = "/api/v1/trips/"
AVAILABLE_TRIPS_URL = f"{TRIPS_URL}available/"
PAYMENTS_URL = "/api/v1/payments/"
WEBHOOK_URL = f"{PAYMENTS_URL}webhook/"


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

    # 2. Student B joins.
    join_resp = second_client.post(f"{GROUPS_URL}{group_id}/join/", format="json")
    assert join_resp.status_code == status.HTTP_200_OK
    assert join_resp.json()["member_count"] == 2

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
    assert available.json()["count"] == 1

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

    # 6. Student pays; the provider webhook confirms the charge.
    pay_resp = student_client.post(
        PAYMENTS_URL,
        {"trip": trip_id, "amount": 200, "currency": "NGN"},
        format="json",
    )
    assert pay_resp.status_code == status.HTTP_201_CREATED
    payment_ref = pay_resp.json()["provider_reference"]
    assert payment_ref

    # Signed webhook confirmed against the manual provider in tests.
    webhook = student_client.post(
        WEBHOOK_URL,
        {"event": "payment.success", "data": {"reference": payment_ref, "status": "success"}},
        format="json",
    )
    assert webhook.status_code == status.HTTP_200_OK

    payment = Payment.objects.get(pk=pay_resp.json()["id"])
    assert payment.status == Payment.Status.SUCCESSFUL
    assert payment.provider_event == "payment.success"

    # 7. Student rates the completed ride once.
    rating = student_client.post(
        f"{TRIPS_URL}{trip_id}/rating/",
        {"score": 5, "comment": "Smooth ride"},
        format="json",
    )
    assert rating.status_code == status.HTTP_201_CREATED
    assert TripRating.objects.get(pk=rating.json()["id"]).score == 5

    duplicate_rating = student_client.post(
        f"{TRIPS_URL}{trip_id}/rating/",
        {"score": 4},
        format="json",
    )
    assert duplicate_rating.status_code == status.HTTP_409_CONFLICT

    # 8. Ledger surfaces in the paginated payments list.
    payments_list = student_client.get(PAYMENTS_URL)
    assert payments_list.status_code == status.HTTP_200_OK
    assert payments_list.json()["count"] == 1
    assert payments_list.json()["results"][0]["status"] == "SUCCESSFUL"


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

    cancel = driver_client.post(f"{TRIPS_URL}{trip.id}/cancel/driver/", format="json")
    assert cancel.status_code == status.HTTP_200_OK
    assert cancel.json()["status"] == "CANCELLED"

    trip.refresh_from_db()
    assert trip.status == Trip.Status.CANCELLED
    assert DriverProfile.objects.get(user=driver_user).availability_status == DriverProfile.AvailabilityStatus.ONLINE
    assert Notification.objects.filter(user=student_user, title="Trip cancelled").exists()
