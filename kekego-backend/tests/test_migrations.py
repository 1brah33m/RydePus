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