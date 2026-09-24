from django.conf import settings
from django.db import models

from apps.trips.models import Trip


class Payment(models.Model):
    """A payment record for a completed trip or a group buyout intent.

    Server-side rules that live in the database:
    - exactly one target (``trip`` XOR ``group``);
    - amounts and seat counts are never negative (and must be positive);
    - refunds can never exceed the original amount;
    - a payer may reuse an idempotency key only for the same intent.
    """

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
    provider_reference = models.CharField(max_length=255, blank=True, default="")

    # Reconciliation: provider-reported settlement id and last event observed.
    settlement_reference = models.CharField(max_length=255, blank=True, default="")
    provider_event = models.CharField(max_length=80, blank=True, default="")
    reconciled_at = models.DateTimeField(null=True, blank=True)

    # Refund ledger summary (individual refunds live in ``Refund``).
    refunded_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    refunded_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(trip__isnull=False, group__isnull=True) | models.Q(trip__isnull=True, group__isnull=False)
                ),
                name="payment_has_one_target",
            ),
            models.UniqueConstraint(
                condition=~models.Q(idempotency_key=""),
                fields=("payer", "idempotency_key"),
                name="payment_unique_payer_idempotency_key",
            ),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="payment_amount_positive"),
            models.CheckConstraint(condition=models.Q(seats__gte=1), name="payment_seats_positive"),
            models.CheckConstraint(
                condition=models.Q(refunded_amount__gte=0, refunded_amount__lte=models.F("amount")),
                name="payment_refunded_amount_bounded",
            ),
        ]
        indexes = [
            models.Index(fields=("status", "provider_reference"), name="pay_status_provref_idx"),
            models.Index(fields=("payer", "-created_at"), name="pay_payer_created_idx"),
            models.Index(fields=("group", "kind", "status"), name="pay_group_kind_status_idx"),
        ]

    def __str__(self) -> str:
        return f"Payment {self.id} - {self.amount} {self.currency}"

    @property
    def is_refundable(self) -> bool:
        return self.status == self.Status.SUCCESSFUL and self.refunded_amount < self.amount


class Refund(models.Model):
    """A single refund against a successful payment."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="initiated_refunds"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    provider_reference = models.CharField(max_length=255, blank=True, default="")
    failure_reason = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="refund_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"Refund {self.id} for payment {self.payment_id} - {self.amount}"
