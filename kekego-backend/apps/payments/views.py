from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pricing import total_fare
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
    """Record a fare payment (cash or direct bank transfer).

    Any member of the group may pay. The amount is checked against the trip's
    per-seat fare times the number of seats being covered, and the payment is
    settled immediately: a student's declaration that they paid is the source
    of truth, since there is no provider to confirm against.
    """

    method = serializers.ChoiceField(choices=Payment.Method.choices)
    seats = serializers.IntegerField(min_value=1, default=1)

    class Meta:
        model = Payment
        fields = ("trip", "amount", "currency", "method", "seats")

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

        # Nobody may pay for more seats than the keke has.
        seats = attrs["seats"]
        if seats > trip.group.capacity:
            raise serializers.ValidationError("You cannot pay for more seats than the group has.")

        expected = total_fare(trip.fare, seats)
        if attrs["amount"] != expected:
            raise serializers.ValidationError(
                f"Payment amount must be {expected} ({seats} seat(s) at {trip.fare} each)."
            )

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

        # A seat commitment (buyout) reserves seats for the group but is not a
        # payment to the driver: the student still settles the full committed
        # total on the trip. The amount is already constrained to
        # seats x trip.fare above, so a committed student is never blocked.
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return Payment.objects.create(
            payer=user,
            kind=Payment.Kind.TRIP,
            # No provider and no driver verification step: the student's
            # declaration settles it now.
            status=Payment.Status.SUCCESSFUL,
            confirmed_at=timezone.now(),
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
    """GET /api/v1/payments/collectable/ - fares collected on the driver's rides.

    Kept as a read-only record for drivers; there is nothing left to confirm.
    """

    permission_classes = [IsDriver]

    def get(self, request):
        payments = (
            Payment.objects.filter(trip__driver=request.user, kind=Payment.Kind.TRIP)
            .select_related("payer", "trip")
            .order_by("-created_at")
        )
        return Response(PaymentSerializer(payments, many=True).data)
