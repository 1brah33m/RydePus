from django.conf import settings
from django.db import models

from apps.trips.models import Trip


class Payment(models.Model):
    """A payment record for a completed trip or a group buyout intent."""

    class Kind(models.TextChoices):
        TRIP = "TRIP", "Trip"
        GROUP_BUYOUT = "GROUP_BUYOUT", "Group buyout"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, null=True, blank=True, related_name="payments")
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="payments",
    )
    payer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments_made")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="NGN")
    seats = models.PositiveIntegerField(default=1)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.TRIP)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    idempotency_key = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(trip__isnull=False, group__isnull=True) | models.Q(trip__isnull=True, group__isnull=False)),
                name="payment_has_one_target",
            ),
            models.UniqueConstraint(
                condition=~models.Q(idempotency_key=""),
                fields=("payer", "idempotency_key"),
                name="payment_unique_payer_idempotency_key",
            ),
        ]

    def __str__(self) -> str:
        return f"Payment {self.id} - {self.amount} {self.currency}"