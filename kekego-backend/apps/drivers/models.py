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