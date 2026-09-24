import logging

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.drivers.models import DriverProfile
from apps.trips.models import Trip, TripRating
from apps.users.permissions import IsStudent, IsVerifiedDriver

logger = logging.getLogger("campus_keke.audit")


class TripSerializer(serializers.ModelSerializer):
    """Serialize trip state for API responses."""

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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "driver", "created_at", "updated_at")


class TripRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripRating
        fields = ("id", "trip", "rater", "score", "comment", "created_at")
        read_only_fields = ("id", "trip", "rater", "created_at")
        extra_kwargs = {"score": {"min_value": 1, "max_value": 5}}


class TripRatingCreateView(APIView):
    """POST /api/v1/trips/{id}/rating/ - rate a completed trip once."""

    def post(self, request, trip_id):
        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

        if trip.status != Trip.Status.COMPLETED:
            return Response(
                {"error": {"code": "INVALID", "message": "Only completed trips can be rated."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.id not in {trip.created_by_id, trip.driver_id}:
            return Response(
                {"error": {"code": "PERMISSION_DENIED", "message": "Only trip participants can submit a rating."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TripRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if TripRating.objects.filter(trip=trip, rater=request.user).exists():
            return Response(
                {"error": {"code": "DUPLICATE", "message": "You have already rated this trip."}},
                status=status.HTTP_409_CONFLICT,
            )
        rating = serializer.save(trip=trip, rater=request.user)
        return Response(TripRatingSerializer(rating).data, status=status.HTTP_201_CREATED)


class TripCreateSerializer(serializers.ModelSerializer):
    """Create a trip from a student-owned group."""

    class Meta:
        model = Trip
        fields = ("group", "pickup_location", "destination", "fare")

    def validate_group(self, value):
        user = self.context["request"].user
        if not value.members.filter(user=user).exists():
            raise serializers.ValidationError("You must be a member of the group to create a trip.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Trip.objects.create(created_by=user, **validated_data)


class TripListCreateView(APIView):
    """GET/POST /api/v1/trips/ - list trips or create one as a student."""

    permission_classes = [IsStudent]

    def get(self, request):
        trips = Trip.objects.filter(created_by=request.user)
        return Response(TripSerializer(trips, many=True).data)

    def post(self, request):
        serializer = TripCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        trip = serializer.save()
        return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


class AvailableTripListView(APIView):
    """GET /api/v1/trips/available/ - list pending trips for online drivers."""

    permission_classes = [IsVerifiedDriver]

    def get(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        if profile.availability_status != DriverProfile.AvailabilityStatus.ONLINE:
            return Response(
                {"error": {"code": "INVALID", "message": "Driver must be online to view available trips."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trips = Trip.objects.filter(status=Trip.Status.PENDING, driver__isnull=True)
        if profile.preferred_pickup_location:
            trips = trips.filter(pickup_location__iexact=profile.preferred_pickup_location.strip())
        if profile.preferred_destination:
            trips = trips.filter(destination__iexact=profile.preferred_destination.strip())
        pickup = request.query_params.get("pickup_location")
        destination = request.query_params.get("destination")
        if pickup:
            trips = trips.filter(pickup_location__iexact=pickup.strip())
        if destination:
            trips = trips.filter(destination__iexact=destination.strip())
        page = request.query_params.get("page")
        page_size = request.query_params.get("page_size")
        if page or page_size:
            try:
                page_number = max(int(page or 1), 1)
                size = min(max(int(page_size or 20), 1), 100)
            except (TypeError, ValueError):
                return Response({"error": {"code": "INVALID", "message": "page and page_size must be integers."}}, status=status.HTTP_400_BAD_REQUEST)
            start = (page_number - 1) * size
            total = trips.count()
            trips = trips[start : start + size]
            return Response({"count": total, "page": page_number, "page_size": size, "results": TripSerializer(trips, many=True).data})
        return Response(TripSerializer(trips, many=True).data)


class TripAcceptView(APIView):
    """POST /api/v1/trips/{id}/accept/ - driver accepts a pending trip."""

    permission_classes = [IsVerifiedDriver]

    def post(self, request, trip_id):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
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
            logger.info("trip_accepted driver_id=%s trip_id=%s", request.user.id, trip.id)

        return Response(TripSerializer(trip).data)


class StudentTripCancelView(APIView):
    """POST /api/v1/trips/{id}/cancel/ - cancel the student's pending trip."""

    permission_classes = [IsStudent]

    def post(self, request, trip_id):
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

        return Response(TripSerializer(trip).data)


class DriverTripCancelView(APIView):
    """POST /api/v1/trips/{id}/cancel/driver/ - assigned driver cancels an accepted/in-progress trip."""

    permission_classes = [IsVerifiedDriver]

    def post(self, request, trip_id):
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
            profile, _ = DriverProfile.objects.get_or_create(user=request.user)
            profile.availability_status = DriverProfile.AvailabilityStatus.ONLINE
            profile.save(update_fields=["availability_status", "updated_at"])
            logger.info("trip_cancelled_by_driver driver_id=%s trip_id=%s", request.user.id, trip.id)

        return Response(TripSerializer(trip).data)


class TripStatusUpdateView(APIView):
    """POST /api/v1/trips/{id}/start/ or /complete/ - progress a trip status."""

    permission_classes = [IsVerifiedDriver]

    def post(self, request, trip_id, action):
        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

        if trip.driver_id != request.user.id:
            return Response({"error": {"code": "INVALID", "message": "This trip is not assigned to you."}}, status=status.HTTP_400_BAD_REQUEST)

        status_map = {
            "start": Trip.Status.IN_PROGRESS,
            "complete": Trip.Status.COMPLETED,
        }

        new_status = status_map.get(action)
        if new_status is None:
            return Response({"error": {"code": "INVALID", "message": "Unsupported action."}}, status=status.HTTP_400_BAD_REQUEST)

        if not trip.can_transition_to(new_status):
            return Response({"error": {"code": "INVALID", "message": "This status change is not allowed."}}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                trip = Trip.objects.select_for_update().get(pk=trip_id)
            except Trip.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Trip not found."}}, status=status.HTTP_404_NOT_FOUND)

            if trip.driver_id != request.user.id or not trip.can_transition_to(new_status):
                return Response({"error": {"code": "INVALID", "message": "This status change is not allowed."}}, status=status.HTTP_400_BAD_REQUEST)

            trip.status = new_status
            trip.save(update_fields=["status", "updated_at"])

            if new_status == Trip.Status.COMPLETED:
                profile, _ = DriverProfile.objects.get_or_create(user=request.user)
                profile.availability_status = DriverProfile.AvailabilityStatus.ONLINE
                profile.save(update_fields=["availability_status", "updated_at"])
                logger.info("trip_completed driver_id=%s trip_id=%s", request.user.id, trip.id)

        return Response(TripSerializer(trip).data)
