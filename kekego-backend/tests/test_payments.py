import pytest
from rest_framework import status

from apps.drivers.models import DriverProfile
from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.models import User

PAYMENTS_URL = "/api/v1/payments/"

# Gate -> Cafeteria, used wherever a test needs real coordinates so the
# server-side fare is a distance price rather than the MIN_FARE fallback.
ROUTE = {"pickup_lat": 6.4541, "pickup_lng": 3.3947, "destination_lat": 6.4478, "destination_lng": 3.3729}


def _assigned_trip(status=Trip.Status.ACCEPTED, fare=250, driver=None, creator=None, group=None):
    """A trip with a driver on board, ready to be paid."""
    group = group or Group.objects.create(
        name="Market Run",
        pickup_location="Hostel",
        destination="Market",
        capacity=4,
        created_by=creator,
        **ROUTE,
    )
    return Trip.objects.create(
        group=group,
        created_by=creator or group.created_by,
        driver=driver,
        pickup_location=group.pickup_location,
        destination=group.destination,
        fare=fare,
        status=status,
    )


@pytest.mark.django_db
def test_student_payment_settles_immediately_without_driver_confirmation(
    student_user, student_client, driver_user
):
    """Clicking "Paid" is the settlement: no driver verification step."""
    trip = _assigned_trip(driver=driver_user, creator=student_user)

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["trip"] == trip.id
    assert body["amount"] == "250.00"
    assert body["method"] == "CASH"
    assert body["status"] == "SUCCESSFUL"
    assert body["awaiting_confirmation"] is False
    assert body["confirmed_at"] is not None

    payment = Payment.objects.get(trip=trip)
    assert payment.status == Payment.Status.SUCCESSFUL
    assert payment.confirmed_at is not None
    # Nothing waits on a driver, so no driver is recorded against it.
    assert payment.confirmed_by is None


@pytest.mark.django_db
def test_confirmation_endpoints_are_gone(student_user, student_client, driver_user, driver_client):
    """The confirm/reject routes must not silently keep working."""
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.SUCCESSFUL,
    )

    assert driver_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/").status_code == status.HTTP_404_NOT_FOUND
    assert driver_client.post(f"{PAYMENTS_URL}{payment.id}/reject/").status_code == status.HTTP_404_NOT_FOUND
    assert student_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/").status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_any_group_member_can_pay_their_own_seat(student_user, student_client, driver_user):
    """A shared keke is settled per passenger, not by the trip creator alone."""
    group = Group.objects.create(
        name="Shared KeKe",
        pickup_location="Gate",
        destination="Cafeteria",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )
    passenger = User.objects.create_user(
        email="passenger@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    GroupMember.objects.create(group=group, user=passenger)
    trip = _assigned_trip(driver=driver_user, creator=student_user, group=group, fare=300)

    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(passenger)
    response = client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 300, "currency": "NGN", "method": "CASH"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["payer_name"] == passenger.full_name


@pytest.mark.django_db
def test_outsider_cannot_pay_for_someone_elses_ride(student_user, student_client, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    outsider = User.objects.create_user(
        email="nosy@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(outsider)

    response = client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Payment.objects.filter(trip=trip).exists()


@pytest.mark.django_db
def test_payment_requires_a_driver_on_the_trip(student_user, student_client):
    """Cash is handed to a driver, so a trip with no driver cannot be paid."""
    trip = _assigned_trip(status=Trip.Status.PENDING, driver=None, creator=student_user)

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "INVALID"


@pytest.mark.django_db
def test_payment_method_is_required(student_user, student_client, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_bank_transfer_needs_driver_payout_details(student_user, student_client, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)

    without = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "BANK_TRANSFER"},
        format="json",
    )
    assert without.status_code == status.HTTP_400_BAD_REQUEST

    DriverProfile.objects.update_or_create(
        user=driver_user,
        defaults={
            "bank_name": "GTBank",
            "account_number": "0123456789",
            "account_name": "ADE OKOYE",
        },
    )
    with_details = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "BANK_TRANSFER"},
        format="json",
    )

    assert with_details.status_code == status.HTTP_201_CREATED
    assert with_details.json()["method"] == "BANK_TRANSFER"


@pytest.mark.django_db
def test_collectable_list_shows_only_this_drivers_payments(driver_client, student_user, driver_user):
    mine = _assigned_trip(driver=driver_user, creator=student_user)
    theirs = _assigned_trip(driver=driver_user, creator=student_user)
    Payment.objects.create(
        trip=mine,
        payer=student_user,
        amount=mine.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.SUCCESSFUL,
    )
    Payment.objects.create(
        trip=theirs,
        payer=student_user,
        amount=theirs.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.BANK_TRANSFER,
        status=Payment.Status.SUCCESSFUL,
    )

    response = driver_client.get(f"{PAYMENTS_URL}collectable/")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert len(body) == 2
    assert all(item["status"] == "SUCCESSFUL" for item in body)
    assert all(item["awaiting_confirmation"] is False for item in body)


@pytest.mark.django_db
def test_duplicate_payment_for_the_same_trip_is_rejected(student_user, student_client, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payload = {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"}

    first = student_client.post(PAYMENTS_URL, payload, format="json")
    second = student_client.post(PAYMENTS_URL, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert Payment.objects.filter(trip=trip).count() == 1


@pytest.mark.django_db
def test_driver_cannot_create_payment_for_trip(driver_client, student_user, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)

    response = driver_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


# ---------------------------------------------------------------------------
# Seat-count fares
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_paying_for_several_seats_costs_several_seats(student_user, student_client, driver_user):
    """The regression this guards: N seats must cost N x the per-seat fare."""
    trip = _assigned_trip(fare=250, driver=driver_user, creator=student_user)

    single = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH"},
        format="json",
    )
    assert single.status_code == status.HTTP_201_CREATED
    assert single.json()["seats"] == 1

    trip2 = _assigned_trip(fare=250, driver=driver_user, creator=student_user)
    triple = student_client.post(
        PAYMENTS_URL,
        {"trip": trip2.id, "amount": 750, "currency": "NGN", "method": "CASH", "seats": 3},
        format="json",
    )
    assert triple.status_code == status.HTTP_201_CREATED
    assert triple.json()["amount"] == "750.00"
    assert triple.json()["seats"] == 3


@pytest.mark.django_db
def test_multi_seat_payment_must_match_the_seat_price(student_user, student_client, driver_user):
    """Sending one seat's price while claiming three seats must not be accepted."""
    trip = _assigned_trip(fare=250, driver=driver_user, creator=student_user)

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 250, "currency": "NGN", "method": "CASH", "seats": 3},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Payment.objects.filter(trip=trip).exists()


@pytest.mark.django_db
def test_payment_cannot_cover_more_seats_than_the_keke_has(student_user, student_client, driver_user):
    trip = _assigned_trip(fare=250, driver=driver_user, creator=student_user)

    response = student_client.post(
        PAYMENTS_URL,
        {"trip": trip.id, "amount": 1000, "currency": "NGN", "method": "CASH", "seats": 5},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Payment.objects.filter(trip=trip).exists()


@pytest.mark.django_db
def test_group_buyout_is_priced_by_the_server_and_settles_immediately(student_user, student_client):
    group = Group.objects.create(
        name="Buyout Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 3, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["group"] == group.id
    assert body["seats"] == 3
    assert body["kind"] == "GROUP_BUYOUT"
    assert body["status"] == "SUCCESSFUL"
    assert body["awaiting_confirmation"] is False
    # One consolidated charge: the 3 empty seats plus the student's own seat,
    # priced by the server and not by anything the client sent.
    assert body["amount"] == f"{group.fare_per_seat * 4:.2f}"
    assert group.member_count == 1


@pytest.mark.django_db
def test_group_buyout_ignores_a_underquoted_client_amount(student_user, student_client):
    group = Group.objects.create(
        name="Underquote Attempt",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 3, "amount": "1.00", "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["amount"] == f"{group.fare_per_seat * 4:.2f}"


@pytest.mark.django_db
def test_group_buyout_can_take_some_but_not_all_seats(student_user, student_client):
    """Buying a chosen number of seats leaves the rest open for other riders."""
    group = Group.objects.create(
        name="Partial Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 2, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    # 2 empty seats plus the buyer's own seat, in one charge.
    assert response.json()["amount"] == f"{group.fare_per_seat * 3:.2f}"

    group.refresh_from_db()
    assert group.bought_seats == 2
    assert group.seats_filled == 3
    assert group.remaining_seats == 1


@pytest.mark.django_db
def test_group_buyout_rejects_more_seats_than_are_empty(student_user, student_client):
    group = Group.objects.create(
        name="Too Many Seats",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 4, "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Payment.objects.filter(group=group).exists()


@pytest.mark.django_db
def test_group_buyout_can_be_topped_up_in_steps(student_user, student_client):
    """Buying some seats and later the rest is one legitimate flow, not a duplicate."""
    group = Group.objects.create(
        name="Top Up Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )
    url = f"/api/v1/groups/{group.id}/buyout/"

    first = student_client.post(url, {"seats": 2, "currency": "NGN"}, format="json")
    assert first.status_code == status.HTTP_201_CREATED
    # 2 empty seats plus the buyer's own seat (charged on the first buyout).
    assert first.json()["amount"] == f"{group.fare_per_seat * 3:.2f}"

    second = student_client.post(url, {"seats": 1, "currency": "NGN"}, format="json")
    assert second.status_code == status.HTTP_201_CREATED
    # The own seat is already covered, so only the extra seat is billed.
    assert second.json()["amount"] == f"{group.fare_per_seat:.2f}"

    group.refresh_from_db()
    assert group.bought_seats == 3
    assert group.seats_filled == 4
    assert group.is_dispatchable is True

    # Nothing left to buy.
    third = student_client.post(url, {"seats": 1, "currency": "NGN"}, format="json")
    assert third.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_group_buyout_prices_each_payment_separately(student_user, student_client):
    """Two buyouts across the ride must not double-charge the student's own seat."""
    group = Group.objects.create(
        name="Split Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )
    url = f"/api/v1/groups/{group.id}/buyout/"

    student_client.post(url, {"seats": 1, "currency": "NGN"}, format="json")
    student_client.post(url, {"seats": 2, "currency": "NGN"}, format="json")

    assert Payment.objects.filter(group=group).count() == 2
    # Own seat + 1 seat + 2 seats = the whole 4-seat ride, billed once each.
    assert sum(p.amount for p in Payment.objects.filter(group=group)) == group.fare_per_seat * 4


@pytest.mark.django_db
def test_group_api_exposes_the_authoritative_fares(student_user, student_client):
    """The client renders these instead of computing its own price."""
    group = Group.objects.create(
        name="Fare Check",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    response = student_client.get("/api/v1/groups/")

    assert response.status_code == status.HTTP_200_OK
    body = next(item for item in response.json() if item["id"] == group.id)
    assert body["fare_per_seat"] == f"{group.fare_per_seat:.2f}"
    assert body["fare_total"] == f"{group.fare_per_seat * 4:.2f}"
    assert body["remaining_seats"] == 3


@pytest.mark.django_db
def test_group_api_reports_whether_the_member_paid_their_own_seat(student_user, student_client):
    """The buyout quote relies on this flag, so it must flip after the first buyout."""
    group = Group.objects.create(
        name="Own Seat Flag",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
        **ROUTE,
    )

    before = next(item for item in student_client.get("/api/v1/groups/").json() if item["id"] == group.id)
    assert before["own_seat_paid"] is False

    student_client.post(f"/api/v1/groups/{group.id}/buyout/", {"seats": 2, "currency": "NGN"}, format="json")

    after = next(item for item in student_client.get("/api/v1/groups/").json() if item["id"] == group.id)
    assert after["own_seat_paid"] is True