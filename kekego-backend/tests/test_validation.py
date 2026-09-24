"""Validation contracts: fares, coordinates, seats, capacity, and trip states.

These tests pin the "stronger validation" guarantees: the API rejects bad
payloads and the database refuses to persist them even if the API is bypassed.
"""

import pytest
from django.db import IntegrityError, transaction
from rest_framework import status

from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment, Refund
from apps.trips.models import Trip, TripRating

GROUPS_URL = "/api/v1/groups/"
TRIPS_URL = "/api/v1/trips/"


def _group(student_user, **overrides):
    payload = {
        "name": "Validation Group",
        "pickup_location": "Main Gate",
        "destination": "Library",
        "capacity": 4,
        "created_by": student_user,
    }
    payload.update(overrides)
    return Group.objects.create(**payload)


def _trip(student_user, group, **overrides):
    payload = {
        "group": group,
        "created_by": student_user,
        "pickup_location": "Main Gate",
        "destination": "Library",
        "fare": 200,
    }
    payload.update(overrides)
    return Trip.objects.create(**payload)


# --------------------------------------------------------------------------
# Capacity
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_group_capacity_must_be_positive(student_client):
    response = student_client.post(
        GROUPS_URL,
        {"name": "Bad", "pickup_location": "Gate", "destination": "Hostel", "capacity": 0},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "capacity" in response.json().get("errors", {})


@pytest.mark.django_db
def test_group_capacity_is_capped(student_client):
    response = student_client.post(
        GROUPS_URL,
        {"name": "Big", "pickup_location": "Gate", "destination": "Hostel", "capacity": 99},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "capacity" in response.json().get("errors", {})


@pytest.mark.django_db
def test_group_capacity_database_constraint(student_user):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Group.objects.create(
                name="DB invalid",
                pickup_location="Gate",
                destination="Hostel",
                capacity=0,
                created_by=student_user,
            )


# --------------------------------------------------------------------------
# Coordinates
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_out_of_range_group_latitude_rejected(student_client):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Coords",
            "pickup_location": "Gate",
            "destination": "Hostel",
            "capacity": 4,
            "pickup_lat": 91,
            "pickup_lng": 6,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "pickup_lat" in response.json().get("errors", {})


@pytest.mark.django_db
def test_partial_coordinate_pair_rejected(student_client):
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Half coords",
            "pickup_location": "Gate",
            "destination": "Hostel",
            "capacity": 4,
            "pickup_lat": 6.5,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_valid_coordinates_accepted(student_client, student_user):
    group = _group(
        student_user,
        pickup_lat=6.5244,
        pickup_lng=3.3792,
        destination_lat=6.5189,
        destination_lng=3.3783,
    )
    response = student_client.post(
        GROUPS_URL,
        {
            "name": "Good coords",
            "pickup_location": "Gate",
            "destination": "Hostel",
            "capacity": 4,
            "pickup_lat": 6.5244,
            "pickup_lng": 3.3792,
            "destination_lat": 6.5189,
            "destination_lng": 3.3783,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["pickup_lat"] == "6.524400"
    group.refresh_from_db()


@pytest.mark.django_db
def test_trip_coordinate_ranges_enforced_by_database(student_user):
    group = _group(student_user)
    valid = _trip(
        student_user,
        group,
        pickup_lat="90.000000",
        pickup_lng="180.000000",
    )
    valid.refresh_from_db()
    assert float(valid.pickup_lat) == 90.0
    assert float(valid.pickup_lng) == 180.0
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Trip.objects.create(
                group=group,
                created_by=student_user,
                pickup_location="Gate",
                destination="Hostel",
                pickup_lat=99,
                pickup_lng=0,
                fare=120,
            )


# --------------------------------------------------------------------------
# Fares
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_trip_fare_must_be_positive(student_client, student_user):
    group = _group(student_user)
    response = student_client.post(
        TRIPS_URL,
        {
            "group": group.id,
            "pickup_location": "Gate",
            "destination": "Hostel",
            "fare": 0,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "fare" in response.json().get("errors", {})


@pytest.mark.django_db
def test_trip_negative_fare_rejected_by_database(student_user):
    group = _group(student_user)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _trip(student_user, group, fare=-50)


@pytest.mark.django_db
def test_payment_amount_must_be_positive(student_user):
    group = _group(student_user)
    trip = _trip(student_user, group, status=Trip.Status.COMPLETED)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Payment.objects.create(
                trip=trip,
                payer=student_user,
                amount=0,
                kind=Payment.Kind.TRIP,
            )


@pytest.mark.django_db
def test_payment_seats_must_be_positive(student_user):
    group = _group(student_user)
    trip = _trip(student_user, group, status=Trip.Status.COMPLETED)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Payment.objects.create(
                trip=trip,
                payer=student_user,
                amount=100,
                seats=0,
                kind=Payment.Kind.TRIP,
            )


@pytest.mark.django_db
def test_refund_cannot_exceed_original_amount(student_user):
    group = _group(student_user)
    trip = _trip(student_user, group, status=Trip.Status.COMPLETED)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=100,
        kind=Payment.Kind.TRIP,
        status=Payment.Status.SUCCESSFUL,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            payment.refunded_amount = 150
            payment.save()

    refund = Refund.objects.create(payment=payment, initiated_by=student_user, amount=100)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            refund.amount = 0
            refund.save()


# --------------------------------------------------------------------------
# Trip state machine
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_trip_cannot_skip_transition_states(student_user):
    group = _group(student_user)
    trip = _trip(student_user, group)
    assert trip.can_transition_to(Trip.Status.ACCEPTED) is True
    assert trip.can_transition_to(Trip.Status.COMPLETED) is False
    assert trip.can_transition_to(Trip.Status.IN_PROGRESS) is False

    trip.status = Trip.Status.ACCEPTED
    assert trip.can_transition_to(Trip.Status.IN_PROGRESS) is True
    assert trip.can_transition_to(Trip.Status.COMPLETED) is False


@pytest.mark.django_db
def test_trip_rating_score_bounds_enforced(student_user):
    group = _group(student_user)
    trip = _trip(student_user, group, status=Trip.Status.COMPLETED)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            TripRating.objects.create(trip=trip, rater=student_user, score=9)


# --------------------------------------------------------------------------
# Seats
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_buyout_rejects_zero_or_negative_seats(student_client, student_user):
    group = _group(student_user)
    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 0, "currency": "NGN"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_member_seat_cannot_exceed_group_capacity(student_user):
    from apps.users.models import User

    group = _group(student_user, capacity=2)
    other = User.objects.create_user(
        email="seatcheck@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            GroupMember.objects.create(group=group, user=other, seat=99)
