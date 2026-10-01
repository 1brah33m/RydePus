from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Prefetch, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.groups.models import Group, GroupMember, MAX_GROUP_CAPACITY
from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.permissions import IsStudent


class CoordinateField(serializers.DecimalField):
    """Optional WGS84 coordinate validated against its real-world range."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_digits", 9)
        kwargs.setdefault("decimal_places", 6)
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        super().__init__(*args, **kwargs)


def validate_coordinate_pair(attrs, prefix: str, errors: dict) -> None:
    """Validate that both halves of a coordinate pair travel together."""
    lat = attrs.get(f"{prefix}_lat")
    lng = attrs.get(f"{prefix}_lng")
    if (lat is None) != (lng is None):
        errors[f"{prefix}_lng"] = "latitude and longitude must be provided together."
    if lat is not None and not (-90 <= lat <= 90):
        errors[f"{prefix}_lat"] = "latitude must be between -90 and 90."
    if lng is not None and not (-180 <= lng <= 180):
        errors[f"{prefix}_lng"] = "longitude must be between -180 and 180."


class GroupSerializer(serializers.ModelSerializer):
    """Serialize a group with its current membership and creator details."""

    member_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    my_membership = serializers.SerializerMethodField()
    bought_seats = serializers.SerializerMethodField()
    seats_filled = serializers.SerializerMethodField()

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
            "status",
            "member_count",
            "bought_seats",
            "seats_filled",
            "created_by",
            "created_by_name",
            "members",
            "my_membership",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "member_count",
            "bought_seats",
            "seats_filled",
            "created_by",
            "created_by_name",
            "members",
            "my_membership",
            "created_at",
            "updated_at",
        )

    def get_member_count(self, obj):
        # Prefer the annotation supplied by list views so the list endpoint stays
        # a fixed number of queries instead of one COUNT per group.
        annotated = getattr(obj, "annotated_member_count", None)
        if annotated is not None:
            return annotated
        return obj.member_count

    def get_bought_seats(self, obj):
        annotated = getattr(obj, "annotated_bought_seats", None)
        if annotated is not None:
            return annotated
        return obj.bought_seats

    def get_seats_filled(self, obj):
        return min(obj.capacity, self.get_member_count(obj) + self.get_bought_seats(obj))

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_members(self, obj):
        return [
            {
                "id": m.user_id,
                "name": m.user.full_name,
                "is_creator": m.user_id == obj.created_by_id,
            }
            for m in obj.members.all()
        ]

    def get_my_membership(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not user:
            return False
        memberships = self.context.get("my_group_ids")
        if memberships is not None:
            return obj.id in memberships
        return bool(obj.members.filter(user=user).exists())


class GroupCreateSerializer(serializers.ModelSerializer):
    """Create a 4-seat group and add the creator as the first member."""

    pickup_lat = CoordinateField()
    pickup_lng = CoordinateField()
    destination_lat = CoordinateField()
    destination_lng = CoordinateField()
    capacity = serializers.IntegerField(default=MAX_GROUP_CAPACITY, min_value=MAX_GROUP_CAPACITY, max_value=MAX_GROUP_CAPACITY)

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

    def validate(self, attrs):
        errors: dict = {}
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
        # One query for the groups, one for their members, one for this user's
        # memberships and the buyout totals: no per-group queries.
        groups = (
            Group.objects.all()
            .select_related("created_by")
            .prefetch_related(Prefetch("members", queryset=GroupMember.objects.select_related("user")))
            .annotate(
                annotated_member_count=Count("members", distinct=True),
                annotated_bought_seats=Coalesce(
                    Sum(
                        "payments__seats",
                        filter=Q(
                            payments__kind=Payment.Kind.GROUP_BUYOUT,
                            payments__status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
                        ),
                    ),
                    0,
                ),
            )
        )
        my_group_ids = set(request.user.group_memberships.values_list("group_id", flat=True))
        serializer = GroupSerializer(
            groups,
            many=True,
            context={"request": request, "my_group_ids": my_group_ids},
        )
        return Response(serializer.data)

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(GroupSerializer(group, context={"request": request}).data, status=status.HTTP_201_CREATED)


class GroupJoinView(APIView):
    """POST /api/v1/groups/{id}/join/ - join a group as a student."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(pk=group_id)
        except Group.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND)

        if group.members.filter(user=request.user).exists():
            return Response({"error": {"code": "INVALID", "message": "You already joined this group."}}, status=status.HTTP_400_BAD_REQUEST)

        if not group.joinable:
            return Response({"error": {"code": "INVALID", "message": "This group is already at capacity."}}, status=status.HTTP_400_BAD_REQUEST)

        GroupMember.objects.create(group=group, user=request.user)
        group.refresh_status()
        return Response(GroupSerializer(group, context={"request": request}).data)


class GroupLeaveView(APIView):
    """POST /api/v1/groups/{id}/leave/ - leave an uncommitted group."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id)
            except Group.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND)

            if group.trip_set.filter(status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]).exists():
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

            group.refresh_status()
            # A trip that is still searching must stop being dispatched once the
            # group is no longer full (4/4 or bought out).
            if not group.is_dispatchable:
                group.trip_set.filter(status=Trip.Status.PENDING).update(
                    status=Trip.Status.CANCELLED, updated_at=timezone.now()
                )
            return Response(GroupSerializer(group, context={"request": request}).data)


class GroupCancelView(APIView):
    """POST /api/v1/groups/{id}/cancel/ - creator cancels an uncommitted group."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id, created_by=request.user)
            except Group.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND)

            if group.trip_set.filter(status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "A group with a committed trip cannot be cancelled."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            group.trip_set.filter(status=Trip.Status.PENDING).update(status=Trip.Status.CANCELLED)
            group.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupBuyoutView(APIView):
    """POST /api/v1/groups/{id}/buyout/ - fill every remaining seat to dispatch now."""

    permission_classes = [IsStudent]

    def post(self, request, group_id):
        with transaction.atomic():
            try:
                group = Group.objects.select_for_update().get(pk=group_id)
            except Group.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Group not found."}}, status=status.HTTP_404_NOT_FOUND)

            if not group.members.filter(user=request.user).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "You must be a group member to buy out remaining seats."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if group.trip_set.filter(status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]).exists():
                return Response(
                    {"error": {"code": "INVALID", "message": "A group with a committed trip cannot be bought out."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            remaining = group.capacity - group.seats_filled
            if remaining <= 0:
                return Response(
                    {"error": {"code": "INVALID", "message": "This group already has all of its seats taken."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                seats = int(request.data.get("seats", 0))
                amount = request.data["amount"]
            except (TypeError, ValueError, KeyError):
                return Response(
                    {"error": {"code": "INVALID", "message": "seats and amount are required."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # A buyout must cover every remaining seat, otherwise the group is
            # still short of the 4/4 dispatch threshold.
            if seats != remaining:
                return Response(
                    {
                        "error": {
                            "code": "INVALID",
                            "message": f"A buyout must cover all {remaining} remaining seat(s).",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                amount_value = Decimal(str(amount))
            except (InvalidOperation, TypeError, ValueError):
                amount_value = Decimal("0")
            if amount_value <= 0:
                return Response(
                    {"error": {"code": "INVALID", "message": "Amount must be greater than zero."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
            group.refresh_status()

        from apps.payments.views import PaymentSerializer

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class StudentOnlyPingView(APIView):
    """Backwards-compatible student-only endpoint for role checks."""

    permission_classes = [IsStudent]

    def get(self, request):
        return Response({"message": "Student-only endpoint works.", "role": request.user.role})