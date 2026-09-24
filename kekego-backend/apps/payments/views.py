import logging

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.permissions import IsStudent

logger = logging.getLogger("campus_keke.audit")


class PaymentSerializer(serializers.ModelSerializer):
    """Serialize a payment record."""

    class Meta:
        model = Payment
        fields = ("id", "trip", "group", "payer", "amount", "currency", "seats", "kind", "status", "idempotency_key", "created_at", "updated_at")
        read_only_fields = ("id", "payer", "status", "created_at", "updated_at")


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
                if existing.trip_id != trip.id or existing.amount != attrs["amount"] or existing.currency != attrs["currency"]:
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
        payments = Payment.objects.filter(payer=request.user)
        return Response(PaymentSerializer(payments, many=True).data)

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        is_retry = "existing_payment" in serializer.validated_data
        payment = serializer.save()
        logger.info("payment_created payer_id=%s payment_id=%s kind=%s", request.user.id, payment.id, payment.kind)
        response_status = status.HTTP_200_OK if is_retry else status.HTTP_201_CREATED
        return Response(PaymentSerializer(payment).data, status=response_status)
