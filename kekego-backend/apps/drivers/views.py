from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.drivers.models import DriverProfile
from apps.users.permissions import IsVerifiedDriver


class DriverProfileSerializer(serializers.ModelSerializer):
    """Serializer for a driver profile plus the base user fields."""

    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    full_name = serializers.SerializerMethodField()

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
            "is_verified",
            "availability_status",
            "vehicle_type",
            "vehicle_plate",
            "license_number",
            "preferred_pickup_location",
            "preferred_destination",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.user.full_name


class DriverAvailabilitySerializer(serializers.ModelSerializer):
    """Update a driver's availability state with transition enforcement.

    ``BUSY`` cannot be requested (the backend sets it when a trip is accepted
    and clears it when the trip is completed/cancelled), and drivers with a
    running trip cannot flip their availability manually.
    """

    class Meta:
        model = DriverProfile
        fields = ("availability_status", "preferred_pickup_location", "preferred_destination")

    def validate_availability_status(self, value):
        profile = self.instance
        user = self.context["request"].user

        if value == DriverProfile.AvailabilityStatus.BUSY:
            raise serializers.ValidationError(
                {"availability_status": "BUSY is set automatically while a trip is in progress."}
            )
        if user.assigned_trips.filter(status__in=["ACCEPTED", "IN_PROGRESS"]).exists():
            raise serializers.ValidationError(
                {"availability_status": "Complete or cancel your active trip before changing availability."}
            )
        if not profile.can_transition_to(value):
            raise serializers.ValidationError(
                {"availability_status": f"Cannot change availability from {profile.availability_status} to {value}."}
            )
        return value


class DriverMeView(APIView):
    """GET /api/v1/drivers/me/ - verified-driver profile data."""

    permission_classes = [IsVerifiedDriver]

    def get(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        return Response(DriverProfileSerializer(profile).data)


class DriverAvailabilityView(APIView):
    """PATCH /api/v1/drivers/availability/ - update online/offline state."""

    permission_classes = [IsVerifiedDriver]

    def patch(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        serializer = DriverAvailabilitySerializer(
            profile, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DriverProfileSerializer(profile).data, status=status.HTTP_200_OK)
