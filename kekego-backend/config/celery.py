"""Celery application configuration for the Campus Keke project.

Includes:
- beat schedule for periodic operational tasks (metrics, reconciliation);
- task success/failure hooks that update the monitoring counters;
- retry/ack settings loaded from Django settings (``CELERY_`` namespace).
"""

import logging
import os

from celery import Celery
from celery.signals import task_failure, task_success

from config.monitoring import emissions

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("campus_keke")

# Read broker/result settings from Django settings using the CELERY_ namespace
# (e.g. CELERY_BROKER_URL, CELERY_TASK_ALWAYS_EAGER).
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover tasks.py files inside every installed app, so we never need to
# import task modules manually.
app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Intervals
# ---------------------------------------------------------------------------
app.conf.beat_schedule = {
    "collect-metrics-every-minute": {
        "task": "core.monitor_metrics",
        "schedule": 60.0,
    },
    "reconcile-payments-hourly": {
        "task": "core.reconcile_payments",
        "schedule": 3600.0,
    },
    "retry-undelivered-notifications-hourly": {
        "task": "notifications.retry_undelivered",
        "schedule": 3600.0,
    },
    "worker-heartbeat-every-5-minutes": {
        "task": "core.heartbeat",
        "schedule": 300.0,
    },
}


@task_success.connect
def _record_task_success(sender=None, **kwargs) -> None:
    emissions.record_task_success()


@task_failure.connect
def _record_task_failure(sender=None, task_id=None, einfo=None, **kwargs) -> None:
    emissions.record_task_failure()
    logger = logging.getLogger("campus_keke.monitor")
    logger.warning(
        "celery_task_failed task=%s task_id=%s exc=%s",
        getattr(sender, "name", str(sender)),
        task_id,
        getattr(
            einfo,
            "exception_repr",
            type(getattr(einfo, "exception", None)).__name__ if getattr(einfo, "exception", None) else "?",
        ),
    )


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    """Simple task proving the worker itself is alive."""
    print(f"Request: {self.request!r}")
