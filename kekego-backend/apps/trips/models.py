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
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            # Fares are never negative. The API additionally requires > 0.
            models.CheckConstraint(condition=models.Q(fare__gte=0), name="trip_fare_non_negative"),
            models.CheckConstraint(
                condition=(models.Q(pickup_lat__isnull=True) | models.Q(pickup_lat__gte=-90, pickup_lat__lte=90)),
                name="trip_pickup_lat_range",
            ),
            models.CheckConstraint(
                condition=(models.Q(pickup_lng__isnull=True) | models.Q(pickup_lng__gte=-180, pickup_lng__lte=180)),
                name="trip_pickup_lng_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(destination_lat__isnull=True) | models.Q(destination_lat__gte=-90, destination_lat__lte=90)
                ),
                name="trip_destination_lat_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(destination_lng__isnull=True)
                    | models.Q(destination_lng__gte=-180, destination_lng__lte=180)
                ),
                name="trip_destination_lng_range",
            ),
        ]
        indexes = [
            models.Index(fields=("status", "driver"), name="trip_status_driver_idx"),
            models.Index(fields=("created_by", "-created_at"), name="trip_creator_created_idx"),
            models.Index(fields=("pickup_location", "destination"), name="trip_route_idx"),
        ]

    def can_transition_to(self, new_status):
        current = self.status
        valid_transitions = {
            self.Status.PENDING: {self.Status.ACCEPTED, self.Status.CANCELLED},
            self.Status.ACCEPTED: {self.Status.IN_PROGRESS, self.Status.CANCELLED},
            self.Status.IN_PROGRESS: {self.Status.COMPLETED, self.Status.CANCELLED},
        }
        return new_status in valid_transitions.get(current, set())

    @property
    def fare_total(self):
        """What the whole ride is worth: per-seat fare times every filled seat.

        A dispatched keke has all four seats accounted for (members plus any
        bought-out seats), so this is the full amount the driver earns on the
        trip rather than a single seat's price.
        """
        return self.fare * self.group.seats_filled

    def __str__(self) -> str:
        return f"Trip {self.id} - {self.status}"


class Rating(models.Model):
    """A student's rating of a completed trip's driver."""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="ratings")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trip_ratings",
    )
    stars = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("trip", "user")
        constraints = [
            models.CheckConstraint(condition=models.Q(stars__gte=1, stars__lte=5), name="rating_stars_1_to_5"),
        ]
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Rating {self.stars}* for trip {self.trip_id}"