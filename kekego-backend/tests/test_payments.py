import hashlib
import hmac

import pytest
from rest_framework import status

from apps.groups.models import Group
from apps.payments.models import Payment
from apps.payments.providers import PaystackProvider
from apps.trips.models import Trip

PAYMENTS_URL = "/api/v1/payments/"
WEBHOOK_URL = f"{PAYMENTS_URL}webhook/"


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


def _create_buyout_group(student_user, capacity=4):
    return Group.objects.create(
        name="Priced Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=capacity,
        created_by=student_user,
    )


@pytest.mark.django_db
def test_buyout_amount_is_computed_on_server_not_from_client(student_user, student_client):
    group = _create_buyout_group(student_user)
    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 2, "amount": "999999.00", "currency": "NGN"},
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["amount"] == "600.00"
    assert Payment.objects.get(pk=response.json()["id"]).amount == 600


@pytest.mark.django_db
def test_buyout_blocked_when_server_pricing_not_configured(student_user, student_client, settings):
    settings.GROUP_SEAT_FARE = 0
    group = _create_buyout_group(student_user)
    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 2, "amount": "10.00", "currency": "NGN"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def _create_pending_trip_payment(student_user, reference="manual-webhook-ref"):
    group = Group.objects.create(
        name="Webhook Trip",
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
    return Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=250,
        currency="NGN",
        kind=Payment.Kind.TRIP,
        status=Payment.Status.PENDING,
        provider_reference=reference,
    )


@pytest.mark.django_db
def test_webhook_confirms_pending_payment(api_client, student_user):
    payment = _create_pending_trip_payment(student_user)
    response = api_client.post(
        WEBHOOK_URL,
        {"event": "payment.success", "data": {"reference": payment.provider_reference, "status": "success"}},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESSFUL


@pytest.mark.django_db
def test_webhook_keeps_payment_pending_on_failure_event(api_client, student_user):
    payment = _create_pending_trip_payment(student_user)
    response = api_client.post(
        WEBHOOK_URL,
        {"event": "payment.failed", "data": {"reference": payment.provider_reference, "status": "failed"}},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    payment.refresh_from_db()
    assert payment.status == Payment.Status.PENDING


@pytest.mark.django_db
def test_webhook_rejects_malformed_payload(api_client):
    response = api_client.post(WEBHOOK_URL, {"not": "a webhook"}, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID_SIGNATURE"


@pytest.mark.django_db
def test_webhook_unknown_reference_returns_404(api_client):
    response = api_client.post(
        WEBHOOK_URL,
        {"event": "payment.success", "data": {"reference": "no-such-ref", "status": "success"}},
        format="json",
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_paystack_webhook_signature_is_verified():
    provider = PaystackProvider(secret_key="sk-test", webhook_secret="wh-secret")
    body = b'{"event":"charge.success","data":{"reference":"ps-1","status":"success"}}'
    signature = hmac.new(b"wh-secret", body, hashlib.sha512).hexdigest()

    assert provider.verify_webhook(body, {"X-Paystack-Signature": signature}) is True
    assert provider.verify_webhook(body, {"X-Paystack-Signature": "forged"}) is False
    assert provider.verify_webhook(body, {}) is False
