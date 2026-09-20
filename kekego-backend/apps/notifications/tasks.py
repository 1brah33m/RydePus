"""Sample Celery task used to smoke-test the worker/broker setup.

Run it with a live worker:

    celery -A config worker --loglevel=info

then from another terminal:

    python manage.py shell -c "from apps.notifications.tasks import sample_test_task; print(sample_test_task.delay().get())"
"""

import logging

from celery import shared_task

logger = logging.getLogger("campus_keke.tasks")


@shared_task(name="notifications.sample_test_task")
def sample_test_task(message: str = "hello from campus keke") -> str:
    """Simple task that returns a result; verifies the pipeline end-to-end."""
    logger.info("Sample task executed with payload: %s", message)
    return f"processed: {message}"