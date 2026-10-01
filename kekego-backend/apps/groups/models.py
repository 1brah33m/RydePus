from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


#: Every keke seats exactly four passengers; a group is a 4-slot ride request.
MAX_GROUP_CAPACITY = 4


class Group(models.Model):
    """A student-led ride group for a route or destination."""

    class Status(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        FULL = "FULL", "Full"

    name = models.CharField(max_length=150)
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    capacity = models.PositiveIntegerField(default=MAX_GROUP_CAPACITY)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            # Capacity is always the fixed four keke seats, but keep it guarded
            # so a bad API call cannot create an unroutable group.
            models.CheckConstraint(condition=models.Q(capacity__gte=1), name="group_capacity_min"),
            models.CheckConstraint(condition=models.Q(capacity__lte=12), name="group_capacity_max"),
            models.CheckConstraint(
                condition=(models.Q(pickup_lat__isnull=True) | models.Q(pickup_lat__gte=-90, pickup_lat__lte=90)),
                name="group_pickup_lat_range",
            ),
            models.CheckConstraint(
                condition=(models.Q(pickup_lng__isnull=True) | models.Q(pickup_lng__gte=-180, pickup_lng__lte=180)),
                name="group_pickup_lng_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(destination_lat__isnull=True) | models.Q(destination_lat__gte=-90, destination_lat__lte=90)
                ),
                name="group_destination_lat_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(destination_lng__isnull=True)
                    | models.Q(destination_lng__gte=-180, destination_lng__lte=180)
                ),
                name="group_destination_lng_range",
            ),
        ]
        indexes = [
            models.Index(fields=("pickup_location", "destination"), name="group_route_idx"),
            models.Index(fields=("created_by", "-created_at"), name="group_creator_created_idx"),
        ]

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            GroupMember.objects.get_or_create(group=self, user=self.created_by)

    def refresh_status(self):
        """Recalculate FULL/WAITING from the current membership and buyout seats."""
        self.status = self.Status.FULL if self.is_dispatchable else self.Status.WAITING
        Group.objects.filter(pk=self.pk).update(status=self.status, updated_at=timezone.now())

    @property
    def member_count(self):
        return self.members.count()

    @property
    def bought_seats(self):
        """Seats covered by an active group buyout (remaining seats paid for).

        Imported lazily to avoid a circular import (payments -> trips -> groups).
        """
        from apps.payments.models import Payment

        total = self.payments.filter(
            kind=Payment.Kind.GROUP_BUYOUT,
            status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
        ).aggregate(total=Sum("seats"))["total"]
        return total or 0

    @property
    def seats_filled(self):
        """Occupied slots: joined members plus any bought-out seats (capped at capacity)."""
        return min(self.capacity, self.member_count + self.bought_seats)

    @property
    def is_dispatchable(self):
        """True when the group may be sent to the driver queue (4/4 or bought out)."""
        return self.member_count + self.bought_seats >= self.capacity

    @property
    def joinable(self):
        """True while a real member can still take a free seat."""
        return self.seats_filled < self.capacity

    def __str__(self):
        return f"{self.name} ({self.seats_filled}/{self.capacity})"


class GroupMember(models.Model):
    """Membership record for a student in a group.

    ``seat`` is the 1-based slot the member occupies inside ``capacity``. The
    unique constraint on ``(group, seat)`` makes it impossible for concurrent
    joins to over-fill a group even if the check-then-insert race is hit.
    """

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships")
    seat = models.PositiveIntegerField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")
        constraints = [
            models.UniqueConstraint(
                fields=("group", "seat"),
                condition=~models.Q(seat__isnull=True),
                name="group_member_unique_seat",
            ),
            models.CheckConstraint(
                condition=(models.Q(seat__isnull=True) | models.Q(seat__gte=1, seat__lte=12)),
                name="group_member_seat_range",
            ),
        ]
        indexes = [
            models.Index(fields=("group", "user"), name="group_member_user_idx"),
        ]
        ordering = ("joined_at",)

    def __str__(self) -> str:
        return f"{self.user.email} -> {self.group.name}"