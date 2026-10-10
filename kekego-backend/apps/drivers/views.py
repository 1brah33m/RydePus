from django.db.models import Avg, Count
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.drivers.models import DriverProfile
from apps.trips.models import Rating
from apps.users.permissions import IsDriver
from apps.users.serializers import UserSerializer


class DriverProfileSerializer(serializers.ModelSerializer):
    """Serializer for a driver profile plus the base user fields."""

    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    full_name = serializers.SerializerMethodField()
    has_payout_details = serializers.BooleanField(read_only=True)
    rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    class Meta:
        model = DriverProfile
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "role",
            "availability_status",
            "vehicle_type",
            "vehicle_plate",
            "license_number",
            "bank_name",
            "account_number",
            "account_name",
            "has_payout_details",
            "rating",
            "rating_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.user.full_name

    def _rating_stats(self, obj):
        """Average star rating and rating count for the driver's rated trips.

        Cached on the instance so the two method fields share one query.
        """
        cached = getattr(obj, "_rating_stats_cache", None)
        if cached is None:
            aggregate = Rating.objects.filter(trip__driver=obj.user).aggregate(
                average=Avg("stars"), count=Count("id")
            )
            average = aggregate["average"]
            cached = {
                "average": round(average, 1) if average is not None else None,
                "count": aggregate["count"],
            }
            obj._rating_stats_cache = cached
        return cached

    def get_rating(self, obj):
        return self._rating_stats(obj)["average"]

    def get_rating_count(self, obj):
        return self._rating_stats(obj)["count"]


class DriverAvailabilitySerializer(serializers.ModelSerializer):
    """Update a driver's availability state and vehicle details."""

    class Meta:
        model = DriverProfile
        fields = ("availability_status", "vehicle_type", "vehicle_plate", "license_number")


class DriverPayoutSerializer(serializers.ModelSerializer):
    """Update the bank account students transfer fares to.

    All three fields are required together: a half-filled account would leave
    students unable to pay by transfer.
    """

    class Meta:
        model = DriverProfile
        fields = ("bank_name", "account_number", "account_name")

    def validate_account_number(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError("Enter a valid account number (at least 10 digits).")
        return digits

    def validate(self, attrs):
        missing = [f for f in ("bank_name", "account_number", "account_name") if not attrs.get(f)]
        if missing:
            raise serializers.ValidationError(
                "Provide the bank name, account number and account name together."
            )
        return attrs


class DriverMeView(APIView):
    """GET /api/v1/drivers/me/ - driver-only profile data."""

    permission_classes = [IsDriver]

    def get(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        return Response(DriverProfileSerializer(profile).data)


class DriverAvailabilityView(APIView):
    """PATCH /api/v1/drivers/availability/ - update online/offline/busy state."""

    permission_classes = [IsDriver]

    def patch(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        serializer = DriverAvailabilitySerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DriverProfileSerializer(profile).data, status=status.HTTP_200_OK)


class DriverPayoutView(APIView):
    """PATCH /api/v1/drivers/payout/ - set the bank account for ride payouts."""

    permission_classes = [IsDriver]

    def patch(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        serializer = DriverPayoutSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DriverProfileSerializer(profile).data, status=status.HTTP_200_OK)