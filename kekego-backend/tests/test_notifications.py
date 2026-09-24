import pytest
from rest_framework import status

NOTIFICATIONS_URL = "/api/v1/notifications/"


@pytest.mark.django_db
def test_user_can_list_their_notifications(student_user, student_client):
    from apps.notifications.models import Notification

    Notification.objects.create(
        user=student_user,
        title="Trip ready",
        message="Your trip is ready to start.",
        notification_type="TRIP_UPDATE",
    )

    response = student_client.get(NOTIFICATIONS_URL)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["results"][0]["title"] == "Trip ready"


@pytest.mark.django_db
def test_user_sees_only_their_notifications(student_user, student_client):
    from apps.notifications.models import Notification
    from apps.users.models import User

    other_user = User.objects.create_user(
        email="other@example.com",
        password="StrongPass123!",
        role=User.Role.STUDENT,
    )

    Notification.objects.create(
        user=other_user,
        title="Private message",
        message="This should not be visible.",
        notification_type="SYSTEM",
    )

    response = student_client.get(NOTIFICATIONS_URL)
    assert response.status_code == status.HTTP_200_OK
    assert all(item["user"] != other_user.id for item in response.json()["results"])


@pytest.mark.django_db
def test_notification_can_be_marked_read(student_user, student_client):
    from apps.notifications.models import Notification

    notification = Notification.objects.create(
        user=student_user,
        title="Assignment",
        message="You have a trip update.",
        notification_type="TRIP_UPDATE",
    )

    response = student_client.patch(f"{NOTIFICATIONS_URL}{notification.id}/read/", format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["is_read"] is True
