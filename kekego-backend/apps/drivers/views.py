from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.drivers.models import DriverProfile
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
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.user.full_name


class DriverAvailabilitySerializer(serializers.ModelSerializer):
    """Update a driver's availability state."""

    class Meta:
        model = DriverProfile
        fields = ("availability_status",)


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