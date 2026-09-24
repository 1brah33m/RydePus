import pytest
from rest_framework import status

from apps.groups.models import Group
from apps.payments.models import Payment
from apps.trips.models import Trip

PAYMENTS_URL = "/api/v1/payments/"


@pytest.mark.django_db
def test_student_can_create_payment_for_trip(student_user, student_client):
    group = Group.objects.create(
        name="Market Run",
        pickup_location="Hostel",
        destination="Market",
        capacity=2,
        created_by=student_user,
    )
    trip = Trip.objects.create(
        group=group,
        created_by=student_user,
        pickup_location="Hostel",
        destination="Market",
        fare=250,
        status=Trip.Status.COMPLETED,
    )

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["trip"] == trip.id
    assert response.json()["amount"] == "250.00"
    assert response.json()["status"] == "PENDING"


@pytest.mark.django_db
def test_driver_cannot_create_payment_for_trip(driver_client, student_user):
    group = Group.objects.create(
        name="Driver Payment",
        pickup_location="Gate",
        destination="Campus",
        capacity=2,
        created_by=student_user,
    )
    trip = Trip.objects.create(
        group=group,
        created_by=student_user,
        pickup_location="Gate",
        destination="Campus",
        fare=150,
        status=Trip.Status.COMPLETED,
    )

    response = driver_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 150, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_payment_requires_completed_trip(student_user, student_client):
    group = Group.objects.create(
        name="Incomplete Trip",
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
        fare=180,
        status=Trip.Status.PENDING,
    )

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 180, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_student_can_create_group_buyout_payment_intent(student_user, student_client):
    group = Group.objects.create(
        name="Buyout Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 3, "amount": "900.00", "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["group"] == group.id
    assert response.json()["seats"] == 3
    assert response.json()["kind"] == "GROUP_BUYOUT"
    assert response.json()["status"] == "PENDING"
    assert group.member_count == 1


@pytest.mark.django_db
def test_group_buyout_rejects_duplicate_active_intent(student_user, student_client):
    group = Group.objects.create(
        name="Duplicate Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    url = f"/api/v1/groups/{group.id}/buyout/"
    payload = {"seats": 3, "amount": "900.00", "currency": "NGN"}

    first = student_client.post(url, payload, format="json")
    second = student_client.post(url, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def _create_completed_trip(student_user):
    group = Group.objects.create(
        name="Idempotent Trip",
        pickup_location="Hostel",
        destination="Market",
        capacity=2,
        created_by=student_user,
    )
    return Trip.objects.create(
        group=group,
        created_by=student_user,
        pickup_location="Hostel",
        destination="Market",
        fare=250,
        status=Trip.Status.COMPLETED,
    )


@pytest.mark.django_db
def test_payment_retry_with_same_idempotency_key_returns_existing(student_user, student_client):
    trip = _create_completed_trip(student_user)
    payload = {"trip": trip.id, "amount": 250, "currency": "NGN", "idempotency_key": "req-1"}

    first = student_client.post(PAYMENTS_URL, payload, format="json")
    second = student_client.post(PAYMENTS_URL, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_200_OK
    assert first.json()["id"] == second.json()["id"]
    assert Payment.objects.filter(payer=student_user, idempotency_key="req-1").count() == 1


@pytest.mark.django_db
def test_payment_idempotency_key_reused_for_different_fields_rejected(student_user, student_client):
    trip = _create_completed_trip(student_user)
    payload = {"trip": trip.id, "amount": 250, "currency": "NGN", "idempotency_key": "req-2"}

    first = student_client.post(PAYMENTS_URL, payload, format="json")

    changed = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 300, "currency": "NGN", "idempotency_key": "req-2"},
        format="json",
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert changed.status_code == status.HTTP_400_BAD_REQUEST
    assert changed.json()["error"]["code"] == "INVALID"
