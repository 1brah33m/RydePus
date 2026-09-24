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
    # Optional coordinates (WGS84). Ranges are enforced by the DB so a bad
    # client payload can never persist out-of-range latitude/longitude.
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            # Fares are never negative. The API additionally requires > 0 (see
            # the create serializer); this constraint is a safety net.
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

    def __str__(self) -> str:
        return f"Trip {self.id} - {self.status}"


class TripRating(models.Model):
    """A rating submitted by a participant after a trip is completed."""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="ratings")
    rater = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trip_ratings",
    )
    score = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("trip", "rater"), name="unique_trip_rating_per_rater"),
            models.CheckConstraint(condition=models.Q(score__gte=1, score__lte=5), name="trip_rating_score_1_to_5"),
        ]
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Rating for trip {self.trip_id} by {self.rater_id}"
