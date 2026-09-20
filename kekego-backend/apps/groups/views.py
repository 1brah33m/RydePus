from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.permissions import IsStudent


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

    class Meta:
        model = Group
        fields = ("name", "pickup_location", "destination", "capacity")

    def create(self, validated_data):
        user = self.context["request"].user
        return Group.objects.create(created_by=user, **validated_data)


class GroupListView(APIView):
    """GET/POST /api/v1/groups/ - list groups or create one as a student."""

    permission_classes = [IsStudent]

    def get(self, request):
        groups = Group.objects.all()
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


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

        if group.member_count >= group.capacity:
            return Response({"error": {"code": "INVALID", "message": "This group is already at capacity."}}, status=status.HTTP_400_BAD_REQUEST)

        GroupMember.objects.create(group=group, user=request.user)
        return Response(GroupSerializer(group).data)


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

            return Response(GroupSerializer(group).data)


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
    """POST /api/v1/groups/{id}/buyout/ - create a pending buyout payment intent."""

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

            try:
                seats = int(request.data.get("seats", 0))
                amount = request.data["amount"]
            except (TypeError, ValueError, KeyError):
                return Response(
                    {"error": {"code": "INVALID", "message": "seats and amount are required."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            remaining = group.capacity - group.member_count
            if seats < 1 or seats > remaining:
                return Response(
                    {"error": {"code": "INVALID", "message": "Requested seats exceed the group's remaining capacity."}},
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

        from apps.payments.views import PaymentSerializer

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class StudentOnlyPingView(APIView):
    """Backwards-compatible student-only endpoint for role checks."""

    permission_classes = [IsStudent]

    def get(self, request):
        return Response({"message": "Student-only endpoint works.", "role": request.user.role})