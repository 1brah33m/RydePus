"""Celery application configuration for the Campus Keke project."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("campus_keke")

# Read broker/result settings from Django settings using the CELERY_ namespace
# (e.g. CELERY_BROKER_URL, CELERY_TASK_ALWAYS_EAGER).
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover tasks.py files inside every installed app, so we never need to
# import task modules manually.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    """Simple task proving the worker itself is alive."""
    print(f"Request: {self.request!r}")