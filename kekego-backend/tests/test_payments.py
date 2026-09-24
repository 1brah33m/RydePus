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


# --------------------------------------------------------------------------
# Refunds
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_payer_can_request_refund_for_successful_payment(student_user, student_client):
    payment = _create_pending_trip_payment(student_user)
    payment.status = Payment.Status.SUCCESSFUL
    payment.save(update_fields=["status"])

    response = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "100.00", "reason": "Overcharged"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["status"] == "SUCCESSFUL"
    assert body["amount"] == "100.00"
    assert body["provider_reference"] == f"{payment.provider_reference}_refund"

    payment.refresh_from_db()
    assert payment.refunded_amount == 100


@pytest.mark.django_db
def test_refund_rejected_for_pending_payment(student_user, student_client):
    payment = _create_pending_trip_payment(student_user)
    response = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "50.00"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID_STATE"


@pytest.mark.django_db
def test_refund_exceeding_outstanding_amount_rejected(student_user, student_client):
    payment = _create_pending_trip_payment(student_user)
    payment.status = Payment.Status.SUCCESSFUL
    payment.save(update_fields=["status"])

    too_big = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "9999.00"},
        format="json",
    )
    assert too_big.status_code == status.HTTP_400_BAD_REQUEST
    assert too_big.json()["error"]["code"] == "VALIDATION_ERROR"

    zero = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "0.00"},
        format="json",
    )
    assert zero.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_partial_refund_then_full_refund_updates_ledger(student_user, student_client):
    payment = _create_pending_trip_payment(student_user, reference="double-refund")
    payment.status = Payment.Status.SUCCESSFUL
    payment.save(update_fields=["status"])

    first = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "100.00"},
        format="json",
    )
    assert first.status_code == status.HTTP_201_CREATED

    second = student_client.post(
        f"{PAYMENTS_URL}{payment.id}/refund/",
        {"amount": "9999.00"},
        format="json",
    )
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    payment.refresh_from_db()
    assert payment.refunded_amount == 100


@pytest.mark.django_db
def test_refund_webhook_confirms_pending_refund(api_client, student_user):
    payment = _create_pending_trip_payment(student_user)
    payment.status = Payment.Status.SUCCESSFUL
    payment.save(update_fields=["status"])

    from apps.payments.models import Refund

    refund = Refund.objects.create(
        payment=payment,
        initiated_by=student_user,
        amount=80,
        status=Refund.Status.PENDING,
        provider_reference=f"{payment.provider_reference}_refund",
    )

    response = api_client.post(
        WEBHOOK_URL,
        {
            "event": "refund.processed",
            "data": {"reference": f"{payment.provider_reference}_refund", "status": "success"},
        },
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    refund.refresh_from_db()
    payment.refresh_from_db()
    assert refund.status == Refund.Status.SUCCESSFUL
    assert payment.refunded_amount == 80
    assert payment.refunded_at is not None


@pytest.mark.django_db
def test_refund_webhook_unknown_reference_404(api_client):
    response = api_client.post(
        WEBHOOK_URL,
        {"event": "refund.processed", "data": {"reference": "no-such-refund", "status": "success"}},
        format="json",
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


# --------------------------------------------------------------------------
# Reconciliation
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_reconcile_command_confirms_pending_payments(student_user):
    payment = _create_pending_trip_payment(student_user, reference="reconcile-me-1")
    assert payment.status == Payment.Status.PENDING

    from django.core.management import call_command

    call_command("reconcile_payments")

    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESSFUL
    assert payment.provider_event == "manual.verify"


@pytest.mark.django_db
def test_reconcile_applies_provider_failure_state(student_user):
    payment = _create_pending_trip_payment(student_user, reference="reconcile-fail-1")

    from apps.core.management.commands.reconcile_payments import Command as ReconcileCommand

    cmd = ReconcileCommand()
    cmd._apply_result(payment, {"status": "failed", "event": "charge.failed", "provider": ""})
    payment.refresh_from_db()
    assert payment.status == Payment.Status.FAILED
    assert payment.provider_event == "charge.failed"


@pytest.mark.django_db
def test_reconcile_captures_settlement_details(student_user):
    payment = _create_pending_trip_payment(student_user, reference="reconcile-settle-1")

    from apps.core.management.commands.reconcile_payments import Command as ReconcileCommand

    cmd = ReconcileCommand()
    cmd._apply_result(
        payment,
        {"status": "success", "event": "charge.success", "provider": "paystack", "settlement_reference": "settle-9"},
    )
    payment.refresh_from_db()
    assert payment.settlement_reference == "settle-9"
    assert payment.reconciled_at is not None
    assert payment.provider_event == "charge.success"


# --------------------------------------------------------------------------
# Paystack provider (external calls mocked)
# --------------------------------------------------------------------------
def test_paystack_refund_builds_correct_payload():
    from types import SimpleNamespace

    payment = SimpleNamespace(pk=1, provider_reference="paystack-ref-1", currency="NGN")
    provider = PaystackProvider("sk-test", "wh-secret")

    captured = {}

    def fake_api_post(url, payload):
        captured["url"] = url
        captured["payload"] = payload
        return {"status": True, "data": {"reference": "py-1", "status": "success"}}

    provider._api_post = fake_api_post
    result = provider.refund(payment, 50)

    assert captured["url"] == "https://api.paystack.co/transaction/refund"
    assert captured["payload"]["transaction"] == payment.provider_reference
    assert captured["payload"]["amount"] == 5000  # kobo
    assert result["reference"] == "py-1"
    assert result["status"] == "SUCCESS"


def test_paystack_verify_transaction_normalizes_response():
    provider = PaystackProvider("sk-test", "wh-secret")
    provider._api_get = lambda url: {
        "status": True,
        "data": {
            "status": "success",
            "settlement_reference": "settle-42",
            "timeline": [{"event": "Charge Success"}],
        },
    }
    result = provider.verify_transaction("paystack-123")
    assert result["status"] == "SUCCESS"
    assert result["settlement_reference"] == "settle-42"
    assert result["event"] == "Charge Success"


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_payments_list_is_paginated(student_user, student_client):
    for idx in range(3):
        _create_pending_trip_payment(student_user, reference=f"page-{idx}")

    response = student_client.get(PAYMENTS_URL)
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 3
    assert len(body["results"]) == 3
    assert {"id", "status", "kind", "amount", "refunded_amount"} <= set(body["results"][0].keys())
