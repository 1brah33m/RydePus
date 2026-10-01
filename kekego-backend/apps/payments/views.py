from django.db import transaction
from django.db.models import Case, IntegerField, When
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.permissions import IsDriver, IsStudent

#: Trip states in which a student may settle the fare with the driver.
PAYABLE_TRIP_STATUSES = (Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED)


class PaymentSerializer(serializers.ModelSerializer):
    """Serialize a payment record."""

    payer_name = serializers.SerializerMethodField()
    awaiting_confirmation = serializers.BooleanField(read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "trip",
            "group",
            "payer",
            "payer_name",
            "amount",
            "currency",
            "seats",
            "kind",
            "method",
            "status",
            "awaiting_confirmation",
            "confirmed_by",
            "confirmed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_payer_name(self, obj):
        return obj.payer.full_name


class PaymentCreateSerializer(serializers.ModelSerializer):
    """Record a manual fare payment (cash or direct bank transfer).

    Any member of the group may pay their own seat, and the payment starts as
    PENDING until the assigned driver confirms they received the money.
    """

    method = serializers.ChoiceField(choices=Payment.Method.choices)

    class Meta:
        model = Payment
        fields = ("trip", "amount", "currency", "method")

    def validate(self, attrs):
        user = self.context["request"].user
        trip = attrs["trip"]

        if trip is None:
            raise serializers.ValidationError("A trip is required to record a payment.")

        if not trip.group.members.filter(user=user).exists():
            raise serializers.ValidationError("You can only pay for a ride you are part of.")

        # The fare is settled with the driver, so a driver must be on the trip.
        if trip.status not in PAYABLE_TRIP_STATUSES or not trip.driver_id:
            raise serializers.ValidationError("You can only pay once a driver has accepted your ride.")

        if attrs["amount"] != trip.fare:
            raise serializers.ValidationError("Payment amount must match the trip fare.")

        if attrs["method"] == Payment.Method.BANK_TRANSFER:
            profile = getattr(trip.driver, "driver_profile", None)
            if not profile or not profile.has_payout_details:
                raise serializers.ValidationError(
                    "This driver has not set up bank details yet. Pay with cash instead."
                )

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
        return Payment.objects.create(
            payer=user,
            kind=Payment.Kind.TRIP,
            status=Payment.Status.PENDING,
            **validated_data,
        )


class PaymentListCreateView(APIView):
    """GET/POST /api/v1/payments/ - list and create payments for a student's own trips."""

    permission_classes = [IsStudent]

    def get(self, request):
        payments = Payment.objects.filter(payer=request.user).order_by("-created_at")
        return Response(PaymentSerializer(payments, many=True).data)

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class DriverCollectablePaymentListView(APIView):
    """GET /api/v1/payments/collectable/ - fares owed to the signed-in driver."""

    permission_classes = [IsDriver]

    def get(self, request):
        # Awaiting the driver's confirmation first, then newest first.
        pending_first = Case(
            When(status=Payment.Status.PENDING, then=0),
            default=1,
            output_field=IntegerField(),
        )
        payments = (
            Payment.objects.filter(trip__driver=request.user, kind=Payment.Kind.TRIP)
            .select_related("payer", "trip")
            .annotate(pending_first=pending_first)
            .order_by("pending_first", "-created_at")
        )
        return Response(PaymentSerializer(payments, many=True).data)


def _get_driver_payment(request, payment_id):
    """Fetch a payment the driver is allowed to act on, or return an error Response.

    Must be called inside ``transaction.atomic()``: the row is locked so a
    double-tap (or a confirm racing a reject) cannot settle it twice.
    """
    try:
        payment = Payment.objects.select_for_update().get(pk=payment_id)
    except Payment.DoesNotExist:
        return None, Response(
            {"error": {"code": "NOT_FOUND", "message": "Payment not found."}},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not payment.trip_id or payment.trip.driver_id != request.user.id:
        return None, Response(
            {"error": {"code": "FORBIDDEN", "message": "This payment is not for your ride."}},
            status=status.HTTP_403_FORBIDDEN,
        )

    return payment, None


class PaymentConfirmView(APIView):
    """POST /api/v1/payments/{id}/confirm/ - driver confirms cash/transfer receipt."""

    permission_classes = [IsDriver]

    def post(self, request, payment_id):
        with transaction.atomic():
            payment, error = _get_driver_payment(request, payment_id)
            if error is not None:
                return error

            if payment.status == Payment.Status.SUCCESSFUL:
                return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)

            if payment.status == Payment.Status.FAILED:
                return Response(
                    {"error": {"code": "INVALID", "message": "This payment was already marked as not received."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment.status = Payment.Status.SUCCESSFUL
            payment.confirmed_by = request.user
            payment.confirmed_at = timezone.now()
            payment.save(update_fields=["status", "confirmed_by", "confirmed_at", "updated_at"])

        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


class PaymentRejectView(APIView):
    """POST /api/v1/payments/{id}/reject/ - driver says the money never arrived."""

    permission_classes = [IsDriver]

    def post(self, request, payment_id):
        with transaction.atomic():
            payment, error = _get_driver_payment(request, payment_id)
            if error is not None:
                return error

            if payment.status != Payment.Status.PENDING:
                return Response(
                    {"error": {"code": "INVALID", "message": "Only a pending payment can be marked as not received."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment.status = Payment.Status.FAILED
            payment.confirmed_by = request.user
            payment.confirmed_at = timezone.now()
            payment.save(update_fields=["status", "confirmed_by", "confirmed_at", "updated_at"])

        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)
