from django.conf import settings
from django.db import models

from apps.groups.models import Group


class Trip(models.Model):
    """A transport request associated with a group and eventually a driver."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="trip_set")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_trips",
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_trips",
    )
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def can_transition_to(self, new_status):
        current = self.status
        valid_transitions = {
            self.Status.PENDING: {self.Status.ACCEPTED, self.Status.CANCELLED},
            self.Status.ACCEPTED: {self.Status.IN_PROGRESS, self.Status.CANCELLED},
            self.Status.IN_PROGRESS: {self.Status.COMPLETED, self.Status.CANCELLED},
        }
        return new_status in valid_transitions.get(current, set())

    def __str__(self) -> str:
        return f"Trip {self.id} - {self.status}"