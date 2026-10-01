import pytest
from rest_framework import status

from apps.drivers.models import DriverProfile
from apps.groups.models import Group, GroupMember
from apps.payments.models import Payment
from apps.trips.models import Trip
from apps.users.models import User

PAYMENTS_URL = "/api/v1/payments/"


def _assigned_trip(status=Trip.Status.ACCEPTED, fare=250, driver=None, creator=None, group=None):
    """A trip with a driver on board, ready to be paid."""
    group = group or Group.objects.create(
        name="Market Run",
        pickup_location="Hostel",
        destination="Market",
        capacity=4,
        created_by=creator,
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
def test_student_can_record_a_cash_payment_for_an_accepted_trip(student_user, student_client, driver_user):
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
    assert body["status"] == "PENDING"
    assert body["awaiting_confirmation"] is True
    assert body["confirmed_at"] is None


@pytest.mark.django_db
def test_any_group_member_can_pay_their_own_seat(student_user, student_client, driver_user):
    """A shared keke is settled per passenger, not by the trip creator alone."""
    group = Group.objects.create(
        name="Shared KeKe",
        pickup_location="Gate",
        destination="Cafeteria",
        capacity=4,
        created_by=student_user,
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
def test_driver_can_confirm_receipt_of_cash(student_user, driver_user, driver_client):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        currency="NGN",
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )

    response = driver_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["status"] == "SUCCESSFUL"
    assert body["confirmed_by"] == driver_user.id
    assert body["confirmed_at"] is not None
    assert body["awaiting_confirmation"] is False


@pytest.mark.django_db
def test_student_cannot_confirm_their_own_payment(student_user, student_client, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )

    response = student_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    payment.refresh_from_db()
    assert payment.status == Payment.Status.PENDING


@pytest.mark.django_db
def test_other_driver_cannot_confirm_a_payment(student_user, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )
    other_driver = User.objects.create_user(
        email="other-driver@example.com",
        password="StrongPass123!",
        role=User.Role.DRIVER,
    )
    client = __import__("rest_framework.test", fromlist=["APIClient"]).APIClient()
    client.force_authenticate(other_driver)

    response = client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    payment.refresh_from_db()
    assert payment.status == Payment.Status.PENDING


@pytest.mark.django_db
def test_driver_can_mark_a_transfer_as_not_received(driver_client, student_user, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.BANK_TRANSFER,
        status=Payment.Status.PENDING,
    )

    response = driver_client.post(f"{PAYMENTS_URL}{payment.id}/reject/")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "FAILED"


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
        status=Payment.Status.PENDING,
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
    # The payment awaiting confirmation is listed first.
    assert [item["status"] for item in body] == ["PENDING", "SUCCESSFUL"]


@pytest.mark.django_db
def test_confirming_twice_keeps_the_first_confirmation(driver_client, student_user, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )

    first = driver_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")
    payment.refresh_from_db()
    first_confirmed_at = payment.confirmed_at

    second = driver_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")

    assert first.status_code == status.HTTP_200_OK
    assert second.status_code == status.HTTP_200_OK
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESSFUL
    assert payment.confirmed_by == driver_user
    assert first_confirmed_at is not None
    assert payment.confirmed_at == first_confirmed_at


@pytest.mark.django_db
def test_a_settled_payment_cannot_be_rejected_afterwards(driver_client, student_user, driver_user):
    trip = _assigned_trip(driver=driver_user, creator=student_user)
    payment = Payment.objects.create(
        trip=trip,
        payer=student_user,
        amount=trip.fare,
        kind=Payment.Kind.TRIP,
        method=Payment.Method.CASH,
        status=Payment.Status.PENDING,
    )
    driver_client.post(f"{PAYMENTS_URL}{payment.id}/confirm/")

    response = driver_client.post(f"{PAYMENTS_URL}{payment.id}/reject/")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESSFUL


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


@pytest.mark.django_db
def test_student_can_create_group_buyout_payment_intent(student_user, student_client):
    group = Group.objects.create(
        name="Buyout Group",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )

    response = student_client.post(
        f"/api/v1/groups/{group.id}/buyout/",
        {"seats": 3, "amount": "900.00", "currency": "NGN"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["group"] == group.id
    assert response.json()["seats"] == 3
    assert response.json()["kind"] == "GROUP_BUYOUT"
    assert response.json()["status"] == "PENDING"
    assert group.member_count == 1


@pytest.mark.django_db
def test_group_buyout_rejects_duplicate_active_intent(student_user, student_client):
    group = Group.objects.create(
        name="Duplicate Buyout",
        pickup_location="Gate",
        destination="Hostel",
        capacity=4,
        created_by=student_user,
    )
    url = f"/api/v1/groups/{group.id}/buyout/"
    payload = {"seats": 3, "amount": "900.00", "currency": "NGN"}

    first = student_client.post(url, payload, format="json")
    second = student_client.post(url, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST
