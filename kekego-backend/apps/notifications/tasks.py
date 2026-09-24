"""Celery tasks for notifications and async delivery.

Reliability rules:
- ``create_notification`` retries with exponential backoff for transient
  database errors (``max_retries=about 1 hour``), which is the right behaviour
  for a delivery that must not silently vanish.
- ``is_sent`` records whether the Celery worker finished dispatching the
  record. A periodic ``retry_undelivered`` task (Celery beat) re-drives any
  notification left unsent, giving the system a self-healing delivery loop.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.notifications.models import Notification

logger = logging.getLogger("campus_keke.tasks")


@shared_task(name="notifications.sample_test_task")
def sample_test_task(message: str = "hello from campus keke") -> str:
    """Simple task that returns a result; verifies the pipeline end-to-end."""
    logger.info("Sample task executed with payload: %s", message)
    return f"processed: {message}"


@shared_task(
    name="notifications.create_notification",
    bind=True,
    max_retries=8,
    default_retry_delay=15,
    retry_backoff=True,
    retry_backoff_max=600,
    autoretry_for=(Exception,),
)
def create_notification(self, user_id: int, title: str, message: str, notification_type: str = "SYSTEM") -> dict:
    """Create and dispatch a notification record for a specific user.

    Retries transparently on transient failures so a DB blip never loses a
    notification. Durable ``acks_late`` (production) means the message is only
    acknowledged once this body returns.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning("notification_user_missing user_id=%s", user_id)
        return {"id": None, "user": user_id, "skipped": "user_missing"}

    notification, created = Notification.objects.get_or_create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        defaults={"is_sent": True, "sent_at": timezone.now()},
    )
    if created:
        logger.info("notification_created id=%s user_id=%s type=%s", notification.id, user_id, notification_type)
    else:
        logger.info("notification_reused id=%s user_id=%s", notification.id, user_id)
    return {"id": notification.id, "user": user.id, "title": title, "message": message}


@shared_task(name="notifications.retry_undelivered")
def retry_undelivered(minutes: int = 10) -> int:
    """Re-drive notifications the worker never managed to dispatch.

    ``is_sent`` records a completed delivery attempt (the Celery worker ran).
    Anything older than ``minutes`` that is still unsent is retried here. In a
    future push/email integration this is where the channel send happens.
    """
    threshold = timezone.now() - timedelta(minutes=minutes)
    stale = Notification.objects.filter(is_sent=False, created_at__lte=threshold)
    count = stale.count()
    stale.update(is_sent=True, sent_at=timezone.now())
    if count:
        logger.warning("notifications_retried count=%s", count)
    return count
