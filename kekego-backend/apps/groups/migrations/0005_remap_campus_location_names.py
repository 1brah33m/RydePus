"""Realign stored campus location names with the frontend landmark list.

Locations are persisted as free-text display names rather than keys, so renaming
a landmark in the frontend silently orphans every row that stored the old name.
The frontend copes (findLocation falls back to a synthetic location), but routes,
grouping and fare lookups then no longer match, so the stored strings are
rewritten here instead.

Only names that were *renamed* are rewritten. Five landmarks were removed from
the campus list (Faculty of Engineering, Main Auditorium, Middle Block, Library
and Engineering Workshop) and they have no successor, so rows still referencing
them are deliberately left alone rather than deleted: the trips are history, and
removing them is a product decision, not a data cleanup.
"""

from django.db import migrations

#: The landmark names the frontend currently offers. Kept explicit so a drift
#: between this list and CAMPUS_LOCATIONS shows up as a data difference rather
#: than passing silently.
CANONICAL_NAMES = (
    "Main Gate",
    "School of Agriculture",
    "Faculty of Environmental Sciences",
    "ECE Department",
    "Hostel Area(Female)",
    "Hostel Area(Male)",
    "Lecture Theatre Hall",
    "Staff Club",
    "CHE Department",
    "Main University Mosque",
)

#: landmark id -> name changes made when the list was trimmed to ten entries.
RENAMED_NAMES = {
    "Faculty of Environmental Services": "Faculty of Environmental Sciences",
    "Lecture Theatre": "Lecture Theatre Hall",
}

#: Models whose location columns hold these names, and the columns themselves.
LOCATION_FIELDS = (
    ("groups", "Group", ("pickup_location", "destination")),
    ("trips", "Trip", ("pickup_location", "destination")),
)


def _normalize(value):
    """Collapse whitespace and case so hand-entered variants still match."""
    return " ".join(str(value).split()).casefold()


def _build_lookup(mapping):
    """normalized stored value -> replacement.

    Canonical names are folded in first, so a row that already holds a current
    name has its spacing and casing normalised. ``mapping`` is applied second so
    an explicit rename takes precedence over that canonical self-mapping. The
    order matters for the reverse pass, where the rename key is itself a
    canonical name and would otherwise map back to itself and do nothing.
    """
    lookup = {_normalize(name): name for name in CANONICAL_NAMES}
    lookup.update({_normalize(old): new for old, new in mapping.items()})
    return lookup


def _remap(apps, mapping):
    lookup = _build_lookup(mapping)

    for app_label, model_name, fields in LOCATION_FIELDS:
        model = apps.get_model(app_label, model_name)
        for field in fields:
            for value in model.objects.values_list(field, flat=True).distinct():
                replacement = lookup.get(_normalize(value))
                if replacement and replacement != value:
                    count = model.objects.filter(**{field: value}).update(
                        **{field: replacement}
                    )
                    if count:
                        print(
                            f"  {model_name}.{field}: {value!r} -> "
                            f"{replacement!r} ({count} row(s))"
                        )


def remap_locations(apps, _schema_editor):
    """Bring stored names up to date with the current landmark list."""
    _remap(apps, RENAMED_NAMES)


def restore_previous_names(apps, _schema_editor):
    """Put the two renamed landmarks back the way they were.

    Only the renames are reverted. Names that were merely cased or spaced
    differently are left as they are now, since there is no earlier value to
    restore and the canonical spelling is the one we want to keep.
    """
    _remap(apps, {new: old for old, new in RENAMED_NAMES.items()})


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0004_group_status_alter_group_capacity"),
        ("trips", "0004_trip_completed_at_trip_started_at_rating_and_more"),
    ]

    operations = [
        migrations.RunPython(remap_locations, restore_previous_names),
    ]