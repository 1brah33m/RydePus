"""Lightweight load smoke tests.

Run small builds by default so CI stays fast. Bump the dataset with the
``LOAD_SCALE`` environment variable for a heavier local run::

    LOAD_SCALE=20 python -m pytest tests/test_load.py -m load

The point is not benchmarking but guarding against accidental N+1 or
full-table-scan regressions on the most-trafficked list endpoints.
"""

import os

import pytest

from apps.groups.models import Group

SCALE = max(1, int(os.environ.get("LOAD_SCALE", "3")))


@pytest.mark.load
@pytest.mark.django_db
def test_large_group_list_is_paginated(student_user, student_client):
    total = 50 * SCALE
    for idx in range(total):
        Group.objects.create(
            name=f"Group {idx}",
            pickup_location="Main Gate",
            destination="Library",
            capacity=4,
            created_by=student_user,
        )

    response = student_client.get("/api/v1/groups/")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == total
    assert len(body["results"]) == 20  # default PAGE_SIZE
    assert body["page"] == 1


@pytest.mark.load
@pytest.mark.django_db
def test_page_size_capped_at_max_pages(student_user, student_client):
    total = 50 * SCALE
    for idx in range(total):
        Group.objects.create(
            name=f"Cap {idx}",
            pickup_location="Gate",
            destination="Hostel",
            capacity=4,
            created_by=student_user,
        )

    response = student_client.get("/api/v1/groups/", {"page_size": 10_000})
    assert response.status_code == 200
    body = response.json()
    assert body["page_size"] == 100
    assert len(body["results"]) == 100
