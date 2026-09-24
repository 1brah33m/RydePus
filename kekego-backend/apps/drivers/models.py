from django.conf import settings
from django.db import models


class DriverProfile(models.Model):
    """Profile data for a user acting as a driver."""

    class AvailabilityStatus(models.TextChoices):
        OFFLINE = "OFFLINE", "Offline"
        ONLINE = "ONLINE", "Online"
        BUSY = "BUSY", "Busy"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="driver_profile",
    )
    # Driver accounts created through public registration start unverified.
    # Based on verification they cannot operate (go online, view/accept trips).
    is_verified = models.BooleanField(default=False)
    availability_status = models.CharField(
        max_length=20,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.OFFLINE,
    )
    vehicle_type = models.CharField(max_length=80, blank=True, default="")
    vehicle_plate = models.CharField(max_length=30, blank=True, default="")
    license_number = models.CharField(max_length=80, blank=True, default="")
    preferred_pickup_location = models.CharField(max_length=255, blank=True, default="")
    preferred_destination = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Driver profile"
        verbose_name_plural = "Driver profiles"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user.email} ({self.availability_status})"

    def has_active_trip(self) -> bool:
        """True when the driver is assigned to a running trip."""
        from apps.trips.models import Trip

        return self.user.assigned_trips.filter(
            status__in=[Trip.Status.ACCEPTED, Trip.Status.IN_PROGRESS],
        ).exists()

    def can_transition_to(self, target) -> bool:
        """Validate a driver-requested availability change.

        ``BUSY`` is system-managed (set when a trip is accepted and cleared
        when it is completed/cancelled), so the API can never set it directly.
        Manual changes are also blocked while the driver still has an active
        trip so availability cannot drift out of sync with reality.
        """
        if target not in DriverProfile.AvailabilityStatus.values:
            return False
        if target == DriverProfile.AvailabilityStatus.BUSY:
            return False
        if target == self.availability_status:
            return True
        if self.has_active_trip():
            return False
        return target in (
            DriverProfile.AvailabilityStatus.ONLINE,
            DriverProfile.AvailabilityStatus.OFFLINE,
        )
