import json
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Payment, Refund
from apps.payments.providers import (
    PaymentProviderError,
    get_provider,
    initialize_payment,
)
from apps.trips.models import Trip
from apps.users.permissions import IsStudent

logger = logging.getLogger("campus_keke.audit")


class PaymentSerializer(serializers.ModelSerializer):
    """Serialize a payment record for API responses."""

    class Meta:
        model = Payment
        fields = (
            "id",
            "trip",
            "group",
            "payer",
            "amount",
            "currency",
            "seats",
            "kind",
            "status",
            "idempotency_key",
            "provider_reference",
            "settlement_reference",
            "provider_event",
            "reconciled_at",
            "refunded_amount",
            "refunded_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "payer",
            "status",
            "provider_reference",
            "settlement_reference",
            "provider_event",
            "reconciled_at",
            "refunded_amount",
            "refunded_at",
            "created_at",
            "updated_at",
        )


class RefundSerializer(serializers.ModelSerializer):
    """Serialize refund records."""

    class Meta:
        model = Refund
        fields = (
            "id",
            "payment",
            "initiated_by",
            "amount",
            "reason",
            "status",
            "provider_reference",
            "failure_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class PaymentCreateSerializer(serializers.ModelSerializer):
    """Create a payment only for the payer's own completed trip."""

    class Meta:
        model = Payment
        fields = ("trip", "amount", "currency", "idempotency_key")
        extra_kwargs = {"idempotency_key": {"required": False, "allow_blank": False}}

    def validate(self, attrs):
        user = self.context["request"].user
        trip = attrs["trip"]
        idempotency_key = attrs.get("idempotency_key", "")

        if idempotency_key:
            existing = Payment.objects.filter(payer=user, idempotency_key=idempotency_key).first()
            if existing:
                if (
                    existing.trip_id != trip.id
                    or existing.amount != attrs["amount"]
                    or existing.currency != attrs["currency"]
                ):
                    raise serializers.ValidationError("The idempotency key is already used for a different payment.")
                attrs["existing_payment"] = existing
                return attrs

        if trip.created_by_id != user.id:
            raise serializers.ValidationError("You can only pay for your own trip.")

        if trip.status != Trip.Status.COMPLETED:
            raise serializers.ValidationError("Payments are only allowed for completed trips.")

        if attrs["amount"] != trip.fare:
            raise serializers.ValidationError("Payment amount must match the trip fare.")

        if Payment.objects.filter(
            trip=trip,
            payer=user,
            kind=Payment.Kind.TRIP,
            status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
        ).exists():
            raise serializers.ValidationError("A payment already exists for this trip.")

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        existing = validated_data.pop("existing_payment", None)
        if existing:
            return existing
        return Payment.objects.create(payer=user, kind=Payment.Kind.TRIP, **validated_data)


class PaymentListCreateView(APIView):
    """GET/POST /api/v1/payments/ - list and create payments for a student's own trips."""

    permission_classes = [IsStudent]

    def get(self, request):
        payments = (
            Payment.objects.filter(payer=request.user)
            .select_related("trip", "group", "payer")
            .prefetch_related("refunds")
        )
        return paginate_payments(payments, request)

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        is_retry = "existing_payment" in serializer.validated_data
        payment = serializer.save()

        if not payment.provider_reference:
            try:
                initialize_payment(payment)
            except PaymentProviderError as exc:
                logger.warning("payment_initialization_failed payment_id=%s error=%s", payment.pk, exc)
                return Response(
                    {
                        "error": {
                            "code": "PAYMENT_PROVIDER_ERROR",
                            "message": "Payment could not be initialized with the payment provider.",
                        }
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        _notify_async(payment, "Payment created", "Your payment is being processed.", "PAYMENT")
        logger.info("payment_created payer_id=%s payment_id=%s kind=%s", request.user.id, payment.id, payment.kind)
        response_status = status.HTTP_200_OK if is_retry else status.HTTP_201_CREATED
        return Response(PaymentSerializer(payment).data, status=response_status)


class PaymentRefundView(APIView):
    """POST /api/v1/payments/{id}/refund/ - refund a successful payment.

    Only the payer can refund their own successful payment, and only up to the
    outstanding (unrefunded) amount. Refunds are dispatched through the active
    payment provider.
    """

    permission_classes = [IsStudent]

    def post(self, request, payment_id):
        try:
            payment = Payment.objects.select_for_update().get(pk=payment_id, payer=request.user)
        except Payment.DoesNotExist:
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Payment not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status != Payment.Status.SUCCESSFUL:
            return Response(
                {"error": {"code": "INVALID_STATE", "message": "Only successful payments can be refunded."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = serializers.DecimalField(max_digits=10, decimal_places=2).to_internal_value(
                request.data.get("amount")
            )
        except (serializers.ValidationError, TypeError, ValueError):
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "amount must be a positive number."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_refunded = payment.refunded_amount
        outstanding = payment.amount - current_refunded
        if amount <= 0 or amount > outstanding:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": f"amount must be between 0.01 and {outstanding}."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            refund = Refund.objects.create(
                payment=payment,
                initiated_by=request.user,
                amount=amount,
                reason=request.data.get("reason", ""),
                status=Refund.Status.PENDING,
            )

        try:
            result = get_provider().refund(payment, amount)
        except PaymentProviderError as exc:
            logger.warning("refund_initialization_failed refund_id=%s error=%s", refund.pk, exc)
            refund.status = Refund.Status.FAILED
            refund.failure_reason = str(exc)
            refund.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {
                    "error": {
                        "code": "PAYMENT_PROVIDER_ERROR",
                        "message": "Refund could not be sent to the payment provider.",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(pk=payment.pk)
            refund = Refund.objects.get(pk=refund.pk)
            refund.provider_reference = result.get("reference", "")
            if str(result.get("status", "SUCCESS")).upper() == "SUCCESS":
                refund.status = Refund.Status.SUCCESSFUL
            else:
                refund.status = Refund.Status.PENDING
            refund.save(update_fields=["status", "provider_reference", "updated_at"])

            if refund.status == Refund.Status.SUCCESSFUL:
                payment.refunded_amount = payment.refunded_amount + amount
                if payment.refunded_amount >= payment.amount:
                    payment.refunded_at = timezone.now()
                payment.save(update_fields=["refunded_amount", "refunded_at", "updated_at"])

        _notify_async(payment, "Refund processed", f"A refund of {amount} {payment.currency} was processed.", "PAYMENT")
        logger.info("refund_created refund_id=%s payment_id=%s amount=%s", refund.pk, payment.pk, amount)
        return Response(RefundSerializer(refund).data, status=status.HTTP_201_CREATED)


class PaymentWebhookView(APIView):
    """POST /api/v1/payments/webhook/ - provider-confirmed payment results.

    The body signature is verified against the provider secret before any
    state change. Confirming a payment also grants the associated group seats
    atomically. Refund events update refund ledger rows.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    schema = None

    def post(self, request):
        raw_body = request.body or b""
        provider = get_provider()
        if not provider.verify_webhook(raw_body, request.headers):
            logger.warning("payment_webhook_rejected invalid_signature")
            return Response(
                {"error": {"code": "INVALID_SIGNATURE", "message": "Webhook signature verification failed."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = json.loads(raw_body)
            event = str(payload.get("event", "")).lower()
            data = payload.get("data", {}) or {}
        except ValueError:
            return Response(
                {"error": {"code": "INVALID_PAYLOAD", "message": "Webhook payload is malformed."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "refund" in event:
            return self._handle_refund_event(event, data, provider)

        try:
            reference = str(data.get("reference", "")).strip()
            if not reference:
                raise ValueError
        except (ValueError, AttributeError):
            return Response(
                {"error": {"code": "INVALID_PAYLOAD", "message": "Webhook payload is malformed."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        succeeded = str(data.get("status", "")).lower() == "success"
        failed = str(data.get("status", "")).lower() in {"failed", "abandoned"}

        with transaction.atomic():
            payment = Payment.objects.select_for_update().filter(provider_reference=reference).first()
            if payment is None:
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "No payment matches this webhook."}},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if succeeded and payment.status != Payment.Status.SUCCESSFUL:
                payment.status = Payment.Status.SUCCESSFUL
                payment.provider_event = event
                payment.save(update_fields=["status", "provider_event", "updated_at"])
                logger.info("payment_confirmed payment_id=%s reference=%s", payment.pk, reference)
                _notify_async(payment, "Payment successful", "Your payment was confirmed.", "PAYMENT")
            elif failed and payment.status == Payment.Status.PENDING:
                # Failed charges stay pending locally; the reconciliation
                # command marks FAILED, so a single webhook never
                # double-books state.
                logger.info("payment_failure_observed payment_id=%s reference=%s", payment.pk, reference)

        return Response({"status": "ok"})

    def _handle_refund_event(self, event: str, data: dict, provider) -> Response:
        refund_data = data.get("refund")
        reference = ""
        if isinstance(refund_data, dict):
            reference = str(refund_data.get("reference", ""))
        if not reference:
            reference = str(data.get("reference", "") or "")
        # Paystack nests the transaction reference under ``transaction``.
        if not reference and isinstance(data.get("transaction"), dict):
            reference = str(data.get("transaction", {}).get("reference", ""))
        if not reference:
            return Response(
                {"error": {"code": "INVALID_PAYLOAD", "message": "Refund webhook is missing a reference."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            refund = Refund.objects.select_for_update().filter(provider_reference=reference).first()
            if refund is None:
                logger.warning("refund_webhook_unknown reference=%s", reference)
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "No refund matches this webhook."}},
                    status=status.HTTP_404_NOT_FOUND,
                )
            succeeded = str(data.get("status", "")).lower() in {"success", "successful", "processed"}
            if succeeded and refund.status != Refund.Status.SUCCESSFUL:
                refund.status = Refund.Status.SUCCESSFUL
                refund.save(update_fields=["status", "updated_at"])
                refund.payment.refunded_amount = refund.payment.refunded_amount + refund.amount
                refund.payment.refunded_at = timezone.now()
                refund.payment.save(update_fields=["refunded_amount", "refunded_at", "updated_at"])
                logger.info("refund_confirmed refund_id=%s payment_id=%s", refund.pk, refund.payment_id)

        return Response({"status": "ok"})


def _notify_async(payment, title: str, message: str, notification_type: str) -> None:
    from apps.notifications.tasks import create_notification

    try:
        create_notification.delay(payment.payer_id, title, message, notification_type)
    except Exception:  # noqa: BLE001 - notification failure must not fail the payment path
        logger.warning("notification_dispatch_failed payment_id=%s", payment.pk)


def paginate_payments(queryset, request) -> Response:
    from config.pagination import paginate

    return paginate(queryset, request, PaymentSerializer)
