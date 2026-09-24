import logging
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment
from apps.payments.providers import PaymentProviderError, initialize_payment
from apps.trips.models import Trip
from apps.users.permissions import IsStudent
from config.pagination import paginate

logger = logging.getLogger("campus_keke.audit")

MAX_GROUP_CAPACITY = 12


class CoordinateField(serializers.DecimalField):
    """Optional WGS84 coordinate validated against its real-world range."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_digits", 9)
        kwargs.setdefault("decimal_places", 6)
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        super().__init__(*args, **kwargs)


def coordinate_pair(lat_field: str, lng_field: str, *, lat, lng):
    """Validate that both halves of a coordinate pair travel together."""


def validate_coordinate_pair(attrs, prefix: str, errors: dict) -> None:
    lat = attrs.get(f"{prefix}_lat")
    lng = attrs.get(f"{prefix}_lng")
    if (lat is None) != (lng is None):
        errors[f"{prefix}_lng"] = "latitude and longitude must be provided together."
    if lat is not None and not (-90 <= lat <= 90):
        errors[f"{prefix}_lat"] = "latitude must be between -90 and 90."
    if lng is not None and not (-180 <= lng <= 180):
        errors[f"{prefix}_lng"] = "longitude must be between -180 and 180."


class GroupSerializer(serializers.ModelSerializer):
    """Serialize a group with its current membership count."""

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "pickup_location",
            "destination",
            "pickup_lat",
            "pickup_lng",
            "destination_lat",
            "destination_lng",
            "capacity",
            "member_count",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "member_count", "created_by", "created_at", "updated_at")

    def get_member_count(self, obj):
        return obj.member_count


class GroupCreateSerializer(serializers.ModelSerializer):
    """Create a group and add the creator as the first member."""

    pickup_lat = CoordinateField()
    pickup_lng = CoordinateField()
    destination_lat = CoordinateField()
    destination_lng = CoordinateField()
    capacity = serializers.IntegerField(min_value=1, max_value=MAX_GROUP_CAPACITY)

    class Meta:
        model = Group
        fields = (
            "name",
            "pickup_location",
            "destination",
            "pickup_lat",
            "pickup_lng",
            "destination_lat",
            "destination_lng",
            "capacity",
        )

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("name is required.")
        return value

    def validate_pickup_location(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("pickup_location is required.")
        return value

    def validate_destination(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("destination is required.")
        return value

    def validate(self, attrs):
        errors: dict = {}
        if not attrs.get("capacity") or not 1 <= attrs["capacity"] <= MAX_GROUP_CAPACITY:
            errors["capacity"] = f"capacity must be between 1 and {MAX_GROUP_CAPACITY}."
        validate_coordinate_pair(attrs, "pickup", errors)
        validate_coordinate_pair(attrs, "destination", errors)
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return Group.objects.create(created_by=user, **validated_data)


class GroupListView(APIView):
    """GET/POST /api/v1/groups/ - list groups or create one as a student."""

    permission_classes = [IsStudent]

    def get(self, request):
        groups = Group.objects.all().select_related("created_by").prefetch_related("members")
        return paginate(groups, request, GroupSerializer)

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


class GroupJoinView(APIView):
    """POST /api/v1/groups/{id}/join/ - join a group as a student.

    Capacity is enforced inside a "SELECT ... FOR UPDATE" on the group row so
    concurrent joins serialize, and the unique ``(group, seat)`` constraint is
    a database-level backstop for the check-then-insert window.
    """

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id)
            except Group.DoesNotExist:
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND
                )

            if group.members.filter(user=request.user).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "You already joined this group."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if group.member_count >= group.capacity:
                return Response(
                    {"error": {"code": "INVALID", "message": "This group is already at capacity."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            seat = GroupMember.next_free_seat(group, group.capacity)
            if seat is None:
                return Response(
                    {"error": {"code": "INVALID", "message": "This group is already at capacity."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                GroupMember.objects.create(group=group, user=request.user, seat=seat)
            except IntegrityError:
                # Another request claimed the same seat under concurrency.
                return Response(
                    {"error": {"code": "INVALID", "message": "This group filled up while joining. Try again."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(GroupSerializer(group).data)


class GroupLeaveView(APIView):
    """POST /api/v1/groups/{id}/leave/ - leave an uncommitted group."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id)
            except Group.DoesNotExist:
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND
                )

            if group.trip_set.filter(
                status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]
            ).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "You cannot leave a group with a committed trip."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership = group.members.filter(user=request.user).first()
            if membership is None:
                return Response(
                    {"error": {"code": "INVALID", "message": "You are not a member of this group."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership.delete()
            if not group.members.exists():
                group.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)

            return Response(GroupSerializer(group).data)


class GroupCancelView(APIView):
    """POST /api/v1/groups/{id}/cancel/ - creator cancels an uncommitted group."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id, created_by=request.user)
            except Group.DoesNotExist:
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND
                )

            if group.trip_set.filter(
                status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]
            ).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "A group with a committed trip cannot be cancelled."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            group.trip_set.filter(status=Trip.Status.PENDING).update(status=Trip.Status.CANCELLED)
            group.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupBuyoutView(APIView):
    """POST /api/v1/groups/{id}/buyout/ - create a pending buyout payment intent.

    The amount is derived server-side (``seats * GROUP_SEAT_FARE``); the
    client-supplied figure is ignored so nobody can price their own payment.
    """

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id)
            except Group.DoesNotExist:
                return Response(
                    {"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND
                )

            if not group.members.filter(user=request.user).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "You must be a group member to buy out remaining seats."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if group.trip_set.filter(
                status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]
            ).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "A group with a committed trip cannot be bought out."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                seats = int(request.data.get("seats", 0))
            except (TypeError, ValueError):
                return Response(
                    {"error": {"code": "INVALID", "message": "seats is required."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            remaining = group.capacity - group.member_count
            if seats < 1 or seats > remaining:
                return Response(
                    {"error": {"code": "INVALID", "message": "Requested seats exceed the group's remaining capacity."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            per_seat = Decimal(str(settings.GROUP_SEAT_FARE))
            if per_seat <= 0:
                return Response(
                    {"error": {"code": "INVALID", "message": "Buyout pricing is not configured."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            amount = per_seat * seats

            if Payment.objects.filter(
                group=group,
                payer=request.user,
                kind=Payment.Kind.GROUP_BUYOUT,
                status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
            ).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "A buyout payment already exists for this group."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment = Payment.objects.create(
                group=group,
                payer=request.user,
                amount=amount,
                currency=request.data.get("currency", "NGN"),
                seats=seats,
                kind=Payment.Kind.GROUP_BUYOUT,
            )

        try:
            initialize_payment(payment)
        except PaymentProviderError as exc:
            logger.warning("buyout_initialization_failed payment_id=%s error=%s", payment.pk, exc)
            return Response(
                {
                    "error": {
                        "code": "PAYMENT_PROVIDER_ERROR",
                        "message": "Payment could not be initialized with the payment provider.",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        from apps.payments.views import PaymentSerializer

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class StudentOnlyPingView(APIView):
    """Backwards-compatible student-only endpoint for role checks."""

    permission_classes = [IsStudent]

    def get(self, request):
        return Response({"message": "Student-only endpoint works.", "role": request.user.role})
