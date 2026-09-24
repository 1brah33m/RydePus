from django.conf import settings
from django.db import models


class Group(models.Model):
    """A student-led ride group for a route or destination."""

    name = models.CharField(max_length=150)
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    # Optional coordinates (WGS84) with DB-enforced ranges, matching Trip.
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    capacity = models.PositiveIntegerField(default=1)
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
            # Capacity must always be at least 1; the API caps it at 12.
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
            GroupMember.objects.get_or_create(group=self, user=self.created_by, seat=1)

    @property
    def member_count(self):
        return self.members.count()

    def __str__(self) -> str:
        return self.name


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
        return f"{self.user.email} -> {self.group.name} (seat {self.seat})"

    @staticmethod
    def next_free_seat(group, capacity: int) -> int | None:
        """Smallest unused 1-based slot for ``group`` within ``capacity``."""
        taken = set(GroupMember.objects.filter(group=group, seat__isnull=False).values_list("seat", flat=True))
        for candidate in range(1, capacity + 1):
            if candidate not in taken:
                return candidate
        return None
