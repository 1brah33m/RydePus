import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.drivers.models import DriverProfile
from apps.groups.models import GroupMember
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.trips.models import Rating, Trip
from apps.users.models import User
from apps.users.permissions import IsDriver, IsStudent

logger = logging.getLogger("campus_keke.trips")


class RatingSerializer(serializers.ModelSerializer):
    """A student's rating of a completed trip."""

    stars = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Rating
        fields = ("id", "trip", "stars", "comment", "created_at")
        read_only_fields = ("id", "trip", "created_at")


class TripSerializer(serializers.ModelSerializer):
    """Serialize trip state for API responses, hydrated for the UI."""

    passenger_count = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.SerializerMethodField()
    driver_bank = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = (
            "id",
            "group",
            "created_by",
            "driver",
            "pickup_location",
            "destination",
            "fare",
            "status",
            "passenger_count",
            "driver_name",
            "driver_phone",
            "driver_bank",
            "created_by_name",
            "my_rating",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_passenger_count(self, obj):
        # Members plus any bought-out seats, so a dispatched ride is always 4.
        return obj.group.seats_filled

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver_id else None

    def get_driver_phone(self, obj):
        return obj.driver.phone_number if obj.driver_id else None

    def get_driver_bank(self, obj):
        """Bank details a student needs to transfer the fare directly."""
        if not obj.driver_id:
            return None
        profile = getattr(obj.driver, "driver_profile", None)
        if not profile or not profile.has_payout_details:
            return None
        return {
            "bank_name": profile.bank_name,
            "account_number": profile.account_number,
            "account_name": profile.account_name,
        }

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_my_rating(self, obj):
        user = self.context.get("request").user
        rating = Rating.objects.filter(trip=obj, user=user).first()
        return rating.stars if rating else None


class TripCreateSerializer(serializers.ModelSerializer):
    """Create a trip from a student-owned group."""

    # The database only guarantees ``fare >= 0``; the API requires a real fare
    # so a ride is never dispatched for free by a malformed client.
    fare = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))

    class Meta:
        model = Trip
        fields = ("group", "pickup_location", "destination", "fare")

    def validate_group(self, value):
        user = self.context["request"].user
        if not value.members.filter(user=user).exists():
            raise serializers.ValidationError("You must be a member of the group to create a trip.")

        # A ride request is only dispatched once the group is full: all 4 seats
        # are either taken by members or covered by a buyout payment.
        if not value.is_dispatchable:
            raise serializers.ValidationError(
                f"A group is only sent to drivers when all {value.capacity} seats are taken "
                f"({value.seats_filled}/{value.capacity}). Wait for more passengers or buy out the remaining seats."
            )

        # A group that already rode cannot be dispatched again. is_dispatchable
        # counts seats only, so a full group stays dispatchable indefinitely and
        # a client that re-requests would otherwise create a second trip for a
        # ride that has already been taken.
        if value.trip_set.filter(status=Trip.Status.COMPLETED).exists():
            raise serializers.ValidationError(
                "This group already completed its ride. Leave the group and create a new one to travel again."
            )

        if value.trip_set.filter(
            status__in=[Trip.Status.PENDING, Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS]
        ).exists():
            raise serializers.ValidationError("This group already has an active trip.")

        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Trip.objects.create(created_by=user, **validated_data)


class TripListCreateView(APIView):
    """GET/POST /api/v1/trips/ - list the student's trips or create one."""

    permission_classes = [IsStudent]

    def get(self, request):
        trips = Trip.objects.filter(
            Q(created_by=request.user) | Q(group__members__user=request.user)
        ).distinct()
        return Response(TripSerializer(trips, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = TripCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        trip = serializer.save()
        return Response(TripSerializer(trip, context={"request": request}).data, status=status.HTTP_201_CREATED)


def _driver_profile(request) -> DriverProfile:
    return DriverProfile.objects.get_or_create(user=request.user)[0]


def _notify(user_id: int, title: str, message: str, notification_type: str) -> None:
    """Dispatch a background notification without failing the caller.

    A notification problem must never roll back or fail the trip flow, so any
    dispatch error is swallowed and logged.
    """
    from apps.notifications.tasks import create_notification

    try:
        create_notification.delay(user_id, title, message, notification_type)
    except Exception:  # noqa: BLE001 - notification must never break the trip flow
        logger.warning("notification_dispatch_failed user_id=%s", user_id)


class AvailableTripListView(APIView):
    """GET /api/v1/trips/available/ - list pending trips for online drivers."""

    permission_classes = [IsDriver]

    def get(self, request):
        profile = _driver_profile(request)
        if profile.availability_status != DriverProfile.AvailabilityStatus.ONLINE:
            return Response(
                {"error": {"code": "INVALID", "message": "Driver must be online to view available trips."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only full groups (4/4, or bought out) ever reach the driver queue.
        #
        # The seat counts are derived here rather than read from the cached
        # ``group.status`` so a trip is never hidden by a group whose status was
        # not refreshed (e.g. a buyout that filled the last seat). Subqueries
        # keep the two aggregates from multiplying each other through a join.
        member_count = (
            GroupMember.objects.filter(group=OuterRef("group"))
            .order_by()
            .values("group")
            .annotate(total=Count("pk"))
            .values("total")
        )
        bought_seats = (
            Payment.objects.filter(
                group=OuterRef("group"),
                kind=Payment.Kind.GROUP_BUYOUT,
                status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
            )
            .order_by()
            .values("group")
            .annotate(total=Coalesce(Sum("seats"), Value(0)))
            .values("total")
        )
        trips = (
            Trip.objects.filter(status=Trip.Status.PENDING, driver__isnull=True)
            .annotate(
                _members=Coalesce(Subquery(member_count, output_field=IntegerField()), Value(0)),
                _bought=Coalesce(Subquery(bought_seats, output_field=IntegerField()), Value(0)),
            )
            .annotate(_taken=F("_members") + F("_bought"))
            .filter(_taken__gte=F("group__capacity"))
            .select_related("group", "created_by", "driver")
        )
        return Response(TripSerializer(trips, many=True, context={"request": request}).data)


class AssignedTripListView(APIView):
    """GET /api/v1/trips/assigned/ - the driver's active assignments."""

    permission_classes = [IsDriver]

    def get(self, request):
        trips = Trip.objects.filter(
            driver=request.user,
            status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS],
        )
        return Response(TripSerializer(trips, many=True, context={"request": request}).data)


class DriverTripHistoryView(APIView):
    """GET /api/v1/trips/history/ - the driver's past assignments."""

    permission_classes = [IsDriver]

    def get(self, request):
        trips = Trip.objects.filter(
            driver=request.user,
            status__in=[Trip.Status.COMPLETED, Trip.Status.CANCELLED],
        )
        return Response(TripSerializer(trips, many=True, context={"request": request}).data)


class TripAcceptView(APIView):
    """POST /api/v1/trips/{id}/accept/ - driver accepts a pending trip."""

    permission_classes = [IsDriver]

    def post(self, request, trip_id):
        profile = _driver_profile(request)
        if profile.availability_status != DriverProfile.AvailabilityStatus.ONLINE:
            return Response(
                {"error": {"code": "INVALID", "message": "Driver must be online to accept trips."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                trip = Trip.objects.select_for_update().get(pk=trip_id)
            except Trip.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

            if trip.status != Trip.Status.PENDING or trip.driver_id is not None:
                return Response({"error": {"code": "INVALID", "message": "Only pending trips can be accepted."}}, status=status.HTTP_400_BAD_REQUEST)

            trip.driver = request.user
            trip.status = Trip.Status.ACCEPTED
            trip.save(update_fields=["driver", "status", "updated_at"])
            profile.availability_status = DriverProfile.AvailabilityStatus.BUSY
            profile.save(update_fields=["availability_status", "updated_at"])

            _notify(
                trip.created_by_id,
                "Driver accepted your trip",
                "A driver accepted your trip and is on the way.",
                Notification.Type.TRIP_UPDATE,
            )

        return Response(TripSerializer(trip, context={"request": request}).data)


class StudentTripCancelView(APIView):
    """POST /api/v1/trips/{id}/cancel/ - cancel a trip.

    Students may cancel their own trip while it is still pending. The assigned
    driver may cancel an accepted or in-progress trip, which returns them to
    the online pool and tells the student. Both roles share this endpoint
    because the client already cancels through ``/cancel/``.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id):
        if request.user.role == User.Role.DRIVER:
            return self._driver_cancel(request, trip_id)
        return self._student_cancel(request, trip_id)

    def _student_cancel(self, request, trip_id):
        with transaction.atomic():
            try:
                trip = Trip.objects.select_for_update().get(pk=trip_id, created_by=request.user)
            except Trip.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

            if trip.status != Trip.Status.PENDING:
                return Response(
                    {"error": {"code": "INVALID", "message": "Only pending trips can be cancelled by a student."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trip.status = Trip.Status.CANCELLED
            trip.save(update_fields=["status", "updated_at"])

        return Response(TripSerializer(trip, context={"request": request}).data)

    def _driver_cancel(self, request, trip_id):
        with transaction.atomic():
            try:
                trip = Trip.objects.select_for_update().get(pk=trip_id)
            except Trip.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

            if trip.driver_id != request.user.id:
                return Response(
                    {"error": {"code": "INVALID", "message": "This trip is not assigned to you."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if trip.status not in (Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS):
                return Response(
                    {"error": {"code": "INVALID", "message": "Only accepted or in-progress trips can be cancelled by a driver."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trip.status = Trip.Status.CANCELLED
            trip.save(update_fields=["status", "updated_at"])

            profile = _driver_profile(request)
            profile.availability_status = DriverProfile.AvailabilityStatus.ONLINE
            profile.save(update_fields=["availability_status", "updated_at"])

            _notify(
                trip.created_by_id,
                "Trip cancelled",
                "Your trip was cancelled by the driver.",
                Notification.Type.TRIP_UPDATE,
            )

        return Response(TripSerializer(trip, context={"request": request}).data)


class TripStatusUpdateView(APIView):
    """POST /api/v1/trips/{id}/start/ or /complete/ - progress a trip."""

    permission_classes = [IsDriver]

    def post(self, request, trip_id, action):
        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

        status_map = {
            "start": Trip.Status.IN_PROGRESS,
            "complete": Trip.Status.COMPLETED,
            "cancel": Trip.Status.CANCELLED,
        }

        new_status = status_map.get(action)
        if new_status is None:
            return Response({"error": {"code": "INVALID", "message": "Unsupported action."}}, status=status.HTTP_400_BAD_REQUEST)

        if trip.driver_id != request.user.id:
            return Response({"error": {"code": "INVALID", "message": "This trip is not assigned to you."}}, status=status.HTTP_400_BAD_REQUEST)

        if not trip.can_transition_to(new_status):
            return Response({"error": {"code": "INVALID", "message": "This status change is not allowed."}}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        update_fields = ["status", "updated_at"]
        if new_status == Trip.Status.IN_PROGRESS and trip.started_at is None:
            trip.started_at = now
            update_fields.append("started_at")
        if new_status == Trip.Status.COMPLETED:
            trip.completed_at = now
            update_fields.append("completed_at")

        trip.status = new_status
        trip.save(update_fields=update_fields)

        if new_status == Trip.Status.IN_PROGRESS:
            _notify(
                trip.created_by_id,
                "Trip started",
                "Your trip is now in progress.",
                Notification.Type.TRIP_UPDATE,
            )
        elif new_status == Trip.Status.COMPLETED:
            _notify(
                trip.created_by_id,
                "Trip completed",
                "Your trip has been completed.",
                Notification.Type.TRIP_UPDATE,
            )

        if new_status in (Trip.Status.COMPLETED, Trip.Status.CANCELLED):
            profile = _driver_profile(request)
            profile.availability_status = DriverProfile.AvailabilityStatus.ONLINE
            profile.save(update_fields=["availability_status", "updated_at"])

        return Response(TripSerializer(trip, context={"request": request}).data)


class RateTripView(APIView):
    """POST /api/v1/trips/{id}/rate/ - rate a completed trip.

    A ride is shared, so any student who was in the group may rate it (one
    rating per rider, re-rating updates their own).
    """

    permission_classes = [IsStudent]

    def post(self, request, trip_id):
        trip = Trip.objects.filter(pk=trip_id).first()
        if trip is None:
            return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

        if not trip.group.members.filter(user=request.user).exists():
            return Response(
                {"error": {"code": "FORBIDDEN", "message": "You were not part of this ride."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        if trip.status != Trip.Status.COMPLETED:
            return Response(
                {"error": {"code": "INVALID", "message": "Only completed trips can be rated."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RatingSerializer(
            data={"trip": trip.id, **request.data},
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(
                {"error": {"code": "INVALID", "message": "A rating between 1 and 5 stars is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rating, _ = Rating.objects.update_or_create(
            trip=trip,
            user=request.user,
            defaults={
                "stars": serializer.validated_data["stars"],
                "comment": serializer.validated_data.get("comment", ""),
            },
        )
        return Response(RatingSerializer(rating).data, status=status.HTTP_200_OK)