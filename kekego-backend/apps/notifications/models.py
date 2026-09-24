from django.conf import settings
from django.db import models


class Notification(models.Model):
    """User notification record for system or trip events.

    ``is_sent``/``sent_at`` track async delivery so a failed Celery delivery
    can be retried without re-creating the record (see ``apps.notifications
    .tasks.send_user_notification``).
    """

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
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "is_read", "-created_at"), name="notif_user_read_created_idx"),
            models.Index(fields=("is_sent", "is_read"), name="notif_sent_read_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user.email}: {self.title}"
