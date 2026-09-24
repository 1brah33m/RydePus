"""Periodic operational tasks for Celery beat / monitoring.

These tasks keep the platform observable and self-healing:

- ``monitor_metrics``: snapshots request/error counters and alerts on spikes.
- ``reconcile_payments``: aligns local payment state with the provider.
- ``heartbeat``: a cheap task that proves a worker is alive and booking work.
"""

import logging

from celery import shared_task

from config.monitoring import alerter, emissions

logger = logging.getLogger("campus_keke.tasks")


@shared_task(name="core.monitor_metrics", ignore_result=True)
def monitor_metrics() -> None:
    """Snapshot counters; issue a critical alert when the error rate spikes."""
    snapshot = emissions.collect()
    total = snapshot["requests"]
    error_rate = (snapshot["errors"] / total) if total else 0.0
    logger.info("metrics_collected %s", snapshot)
    if total and error_rate >= 0.5:
        alerter.notify(
            "critical",
            "High API error rate",
            f"{error_rate:.0%} of the last {total} requests returned 5xx.",
        )


@shared_task(name="core.reconcile_payments", ignore_result=True)
def reconcile_payments() -> int:
    """Run provider reconciliation through the management command."""
    from django.core.management import call_command

    return call_command("reconcile_payments", verbosity=0)


@shared_task(name="core.heartbeat", ignore_result=False)
def heartbeat() -> str:
    """Cheap worker heartbeat used by remote inspection tools."""
    return "pong"


@shared_task(name="core.notify_task_failure", ignore_result=True)
def notify_task_failure(task_name: str, task_id: str, exc_repr: str) -> None:
    """Alert once a task has exhausted its retries."""
    emissions.record_task_failure()
    alerter.notify(
        "critical",
        f"Celery task failed: {task_name}",
        f"task_id={task_id} error={exc_repr}",
    )
