"""Server-side ride dispatch.

A group becomes a ride request the moment every seat is committed — four
members, or a buyout that covers the remaining seats. Creating the trip here,
inside the same transaction that filled the group, means the request reaches
the driver queue immediately, with no follow-up call from a student's client.
"""

from __future__ import annotations

from apps.groups.models import Group
from apps.trips.models import Trip

#: Trip states that mean the group already has a ride request in flight.
_ACTIVE_STATUSES = (
    Trip.Status.PENDING,
    Trip.Status.ACCEPTED,
    Trip.Status.IN_PROGRESS,
)


def dispatch_group(group: Group) -> Trip | None:
    """Create a pending ride request for a full group, if it still needs one.

    Returns the trip in flight (existing or freshly created), or ``None`` when
    the group is not full, has already ridden, or already has a request. Safe to
    call after every membership or payment change: callers hold the group row
    lock, so concurrent seat fills cannot stack two requests onto one group.
    """
    if not group.is_dispatchable:
        return None

    # A group that already rode must never be re-dispatched. ``is_dispatchable``
    # counts seats only, so a full group stays full forever; the completed trip
    # is what tells us the ride is done.
    if group.trip_set.filter(status=Trip.Status.COMPLETED).exists():
        return None

    existing = group.trip_set.filter(status__in=_ACTIVE_STATUSES).first()
    if existing is not None:
        return existing

    return Trip.objects.create(
        group=group,
        created_by=group.created_by,
        pickup_location=group.pickup_location,
        destination=group.destination,
        pickup_lat=group.pickup_lat,
        pickup_lng=group.pickup_lng,
        destination_lat=group.destination_lat,
        destination_lng=group.destination_lng,
        # Priced from the route the server already holds: a client cannot
        # dispatch a ride for less than the seats are worth.
        fare=group.fare_per_seat,
        status=Trip.Status.PENDING,
    )
