"""Tests for the campus location name data migration."""

from importlib import import_module

import re
from pathlib import Path

import pytest
from django.apps import apps as django_apps

from apps.groups.models import Group
from apps.trips.models import Trip
from apps.users.models import User

MIGRATION = import_module("apps.groups.migrations.0005_remap_campus_location_names")


def _make_group(pickup, destination, **kwargs):
    creator = kwargs.pop("creator", None) or User.objects.create_user(
        email=f"loc-{pickup}-{destination}@example.com".replace(" ", "-").lower(),
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    return Group.objects.create(
        name=kwargs.pop("name", "Route"),
        pickup_location=pickup,
        destination=destination,
        capacity=4,
        created_by=creator,
        **kwargs,
    )


def _make_trip(group, pickup, destination):
    return Trip.objects.create(
        group=group,
        pickup_location=pickup,
        destination=destination,
        fare=200,
        created_by=group.created_by,
    )


@pytest.mark.django_db
def test_renamed_landmarks_are_updated_on_groups_and_trips():
    group = _make_group("Faculty of Environmental Services", "Lecture Theatre")
    trip = _make_trip(
        group, "Faculty of Environmental Services", "Lecture Theatre"
    )

    MIGRATION.remap_locations(django_apps, None)

    group.refresh_from_db()
    trip.refresh_from_db()
    assert group.pickup_location == "Faculty of Environmental Sciences"
    assert group.destination == "Lecture Theatre Hall"
    assert trip.pickup_location == "Faculty of Environmental Sciences"
    assert trip.destination == "Lecture Theatre Hall"


@pytest.mark.django_db
def test_both_columns_are_covered_in_either_order():
    """destination is remapped too, not just pickup_location."""
    group = _make_group("Main Gate", "Faculty of Environmental Services")
    trip = _make_trip(group, "Lecture Theatre", "Faculty of Environmental Sciences")

    MIGRATION.remap_locations(django_apps, None)

    trip.refresh_from_db()
    assert trip.pickup_location == "Lecture Theatre Hall"
    assert trip.destination == "Faculty of Environmental Sciences"


@pytest.mark.django_db
def test_canonical_names_get_spacing_and_casing_normalised():
    group = _make_group("  main gate ", "hostel area(female)")

    MIGRATION.remap_locations(django_apps, None)

    group.refresh_from_db()
    assert group.pickup_location == "Main Gate"
    assert group.destination == "Hostel Area(Female)"


@pytest.mark.django_db
def test_removed_landmarks_are_left_alone():
    """No successor exists, so history is preserved rather than deleted."""
    group = _make_group("Faculty of Engineering", "Library")

    MIGRATION.remap_locations(django_apps, None)

    group.refresh_from_db()
    assert group.pickup_location == "Faculty of Engineering"
    assert group.destination == "Library"
    assert Group.objects.filter(pk=group.pk).exists()


@pytest.mark.django_db
def test_migration_is_idempotent():
    group = _make_group("Faculty of Environmental Services", "Lecture Theatre")

    MIGRATION.remap_locations(django_apps, None)
    MIGRATION.remap_locations(django_apps, None)

    group.refresh_from_db()
    assert group.pickup_location == "Faculty of Environmental Sciences"
    assert group.destination == "Lecture Theatre Hall"


@pytest.mark.django_db
def test_reverse_restores_the_previous_names():
    group = _make_group("Faculty of Environmental Sciences", "Lecture Theatre Hall")
    trip = _make_trip(group, "Faculty of Environmental Sciences", "Lecture Theatre Hall")

    MIGRATION.restore_previous_names(django_apps, None)

    group.refresh_from_db()
    trip.refresh_from_db()
    assert group.pickup_location == "Faculty of Environmental Services"
    assert group.destination == "Lecture Theatre"
    assert trip.pickup_location == "Faculty of Environmental Services"
    assert trip.destination == "Lecture Theatre"


@pytest.mark.django_db
def test_reverse_leaves_canonical_spelling_alone():
    group = _make_group("Main Gate", "Staff Club")

    MIGRATION.restore_previous_names(django_apps, None)

    group.refresh_from_db()
    assert group.pickup_location == "Main Gate"
    assert group.destination == "Staff Club"


def test_removed_landmarks_are_absent_from_the_canonical_list():
    canonical = set(MIGRATION.CANONICAL_NAMES)
    for gone in (
        "Faculty of Engineering",
        "Main Auditorium",
        "Middle Block",
        "Library",
        "Engineering Workshop",
    ):
        assert gone not in canonical


def test_canonical_list_matches_the_frontend_landmarks():
    """The list here must not drift from CAMPUS_LOCATIONS in the frontend."""
    frontend = (
        Path(__file__).resolve().parents[2]
        / "kekego-frontend"
        / "src"
        / "config"
        / "locations.ts"
    )
    if not frontend.exists():
        pytest.skip("frontend not present in this checkout")
    names = re.findall(r"name: '([^']+)'", frontend.read_text(encoding="utf-8"))
    # Only the CAMPUS_LOCATIONS entries, which all precede LOCATION_COORDS.
    assert tuple(names[: len(MIGRATION.CANONICAL_NAMES)]) == MIGRATION.CANONICAL_NAMES
# ---------------------------------------------------------------------------
# Legacy payment settle migration
# ---------------------------------------------------------------------------

SETTLE_MIGRATION = import_module("apps.payments.migrations.0007_alter_payment_status")


@pytest.mark.django_db
def test_legacy_pending_payments_are_settled(student_user, driver_user):
    """Removing the confirm endpoint must not strand previously paid students."""
    from apps.payments.models import Payment
    from apps.trips.models import Trip

    group = Group.objects.create(
        name="Legacy Ride",
        pickup_location="Main Gate",
        destination="Lecture Theatre",
        capacity=4,
        created_by=student_user,
    )
    trip = Trip.objects.create(
        group=group,
        created_by=student_user,
        driver=driver_user,
        pickup_location=group.pickup_location,
        destination=group.destination,
        fare=200,
        status=Trip.Status.COMPLETED,
    )
    stale = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )
    failed = Payment.objects.create(
        group=group,
        payer=student_user,
        amount=500,
        seats=2,
        kind=Payment.Kind.GROUP_BUYOUT,
        method=Payment.Method.BANK_TRANSFER,
        status=Payment.Status.FAILED,
    )

    SETTLE_MIGRATION.settle_pending_payments(django_apps, None)

    stale.refresh_from_db()
    failed.refresh_from_db()
    assert stale.status == Payment.Status.SUCCESSFUL
    assert stale.confirmed_at is not None
    # A payment the driver already rejected stays rejected.
    assert failed.status == Payment.Status.FAILED


@pytest.mark.django_db
def test_new_payments_default_to_settled():
    """The model default matters: an unset status must not become PENDING."""
    from apps.payments.models import Payment

    assert Payment._meta.get_field("status").default == Payment.Status.SUCCESSFUL
