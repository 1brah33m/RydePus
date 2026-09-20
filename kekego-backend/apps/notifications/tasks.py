"""Celery tasks for notifications and async delivery."""

import logging

from celery import shared_task

from apps.notifications.models import Notification

logger = logging.getLogger("campus_keke.tasks")


@shared_task(name="notifications.sample_test_task")
def sample_test_task(message: str = "hello from campus keke") -> str:
    """Simple task that returns a result; verifies the pipeline end-to-end."""
    logger.info("Sample task executed with payload: %s", message)
    return f"processed: {message}"


@shared_task(name="notifications.create_notification")
def create_notification(user_id: int, title: str, message: str, notification_type: str = "SYSTEM") -> dict:
    """Create a notification record for a specific user."""
    from apps.users.models import User

    user = User.objects.get(pk=user_id)
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
    )
    return {"id": notification.id, "user": user.id, "title": title, "message": message}
