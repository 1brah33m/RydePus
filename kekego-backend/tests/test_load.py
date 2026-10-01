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
def test_large_group_list_stays_bounded_in_queries(student_user, student_client, django_assert_max_num_queries):
    """The group list returns every group but must not query per group.

    The endpoint answers with a plain list (not a paginated envelope), so the
    regression this guards against is an N+1 that grows with the dataset.
    """
    total = 50 * SCALE
    for idx in range(total):
        Group.objects.create(
            name=f"Group {idx}",
            pickup_location="Main Gate",
            destination="Library",
            capacity=4,
            created_by=student_user,
        )

    # groups + members + user memberships + buyout aggregate, plus auth/session.
    with django_assert_max_num_queries(8):
        response = student_client.get("/api/v1/groups/")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == total
    assert {row["name"] for row in body} >= {f"Group {idx}" for idx in range(5)}


@pytest.mark.load
@pytest.mark.django_db
def test_group_list_query_count_is_independent_of_dataset_size(student_user, student_client, django_assert_num_queries):
    """Doubling the dataset must not add queries."""
    Group.objects.create(
        name="Solo",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    with django_assert_num_queries(3) as small:
        student_client.get("/api/v1/groups/")

    for idx in range(20):
        Group.objects.create(
            name=f"Bulk {idx}",
            pickup_location="Gate",
            destination="Hostel",
            capacity=4,
            created_by=student_user,
        )
    with django_assert_num_queries(3) as large:
        response = student_client.get("/api/v1/groups/")

    assert len(response.json()) == 21
    assert len(small.captured_queries) == len(large.captured_queries)
