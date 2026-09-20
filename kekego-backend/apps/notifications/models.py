from django.conf import settings
from django.db import models


class Notification(models.Model):
    """User notification record for system or trip events."""

    class Type(models.TextChoices):
        SYSTEM = "SYSTEM", "System"
        TRIP_UPDATE = "TRIP_UPDATE", "Trip update"
        PAYMENT = "PAYMENT", "Payment"
        GROUP = "GROUP", "Group"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=Type.choices, default=Type.SYSTEM)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user.email}: {self.title}"
