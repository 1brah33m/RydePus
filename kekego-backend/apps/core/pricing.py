"""Server-authoritative fare calculation.

Fares used to be computed in the browser (``src/config/pricing.ts``), which
meant the client decided what a seat cost and the API simply stored whatever
amount it was handed. Pricing now lives here so a group's buyout total can be
computed from the route the server already holds.

The formula is kept byte-for-byte equivalent to the former frontend
implementation so quotes do not shift when the client stops computing them:

    fare = max(MIN_FARE, round_to_nearest(BASE_FARE + km * RATE_PER_KM, ROUNDING))

Coordinates are the source of truth. ``Group``/``Trip`` persist
``pickup_lat/lng`` and ``destination_lat/lng``, so a quote needs no extra
lookup table.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

EARTH_RADIUS_KM = 6371


def _to_radians(degrees: float) -> float:
    return math.radians(degrees)


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in kilometres."""
    d_lat = _to_radians(lat2 - lat1)
    d_lng = _to_radians(lng2 - lng1)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(_to_radians(lat1)) * math.cos(_to_radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def _round_to(value: Decimal, step: Decimal) -> Decimal:
    return (value / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * step


def per_seat_fare(
    pickup_lat: float | None,
    pickup_lng: float | None,
    destination_lat: float | None,
    destination_lng: float | None,
) -> Decimal:
    """Price a single seat for a route.

    Falls back to ``MIN_FARE`` when coordinates are unknown, matching the
    frontend's behaviour for a route with no known distance.
    """
    minimum = Decimal(str(settings.MIN_SEAT_FARE))
    if None in (pickup_lat, pickup_lng, destination_lat, destination_lng):
        return minimum

    km = distance_km(
        float(pickup_lat),
        float(pickup_lng),
        float(destination_lat),
        float(destination_lng),
    )
    raw = Decimal(str(settings.BASE_FARE)) + Decimal(str(km)) * Decimal(str(settings.FARE_RATE_PER_KM))
    rounded = _round_to(raw, Decimal(str(settings.FARE_ROUNDING)))
    return max(minimum, rounded).quantize(Decimal("0.01"))


def total_fare(per_seat: Decimal, seats: int) -> Decimal:
    """The amount owed for ``seats`` seats at a per-seat price."""
    if seats < 1:
        raise ValueError("seats must be at least 1")
    return (Decimal(per_seat) * seats).quantize(Decimal("0.01"))