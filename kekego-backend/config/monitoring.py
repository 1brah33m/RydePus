"""Lightweight monitoring plumbing: in-process counters and alert dispatch.

This module deliberately has zero hard dependencies on external monitoring
SaaS. It provides:

- ``emissions``: in-process counters (requests, errors, payloads) exposed as a
  structured ``snapshot()`` for periodic log/beat collection.
- ``AlertNotifier``: route operational alerts to a webhook, email, or the
  structured log stream. Dispatch is best-effort and never crashes the
  request path.
"""

import json
import logging
import threading
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger("campus_keke.monitor")

_LOCK = threading.Lock()


class Emissions:
    """Thread-safe in-process counters polled by Celery beat / CI."""

    def __init__(self) -> None:
        self._requests = 0
        self._errors = 0
        self._tasks_succeeded = 0
        self._tasks_failed = 0

    def record_request(self) -> None:
        with _LOCK:
            self._requests += 1

    def record_error(self) -> None:
        with _LOCK:
            self._errors += 1

    def record_task_success(self) -> None:
        with _LOCK:
            self._tasks_succeeded += 1

    def record_task_failure(self) -> None:
        with _LOCK:
            self._tasks_failed += 1

    def snapshot(self) -> dict:
        with _LOCK:
            return {
                "requests": self._requests,
                "errors": self._errors,
                "tasks_succeeded": self._tasks_succeeded,
                "tasks_failed": self._tasks_failed,
            }

    def reset(self) -> None:
        with _LOCK:
            self._requests = 0
            self._errors = 0
            self._tasks_succeeded = 0
            self._tasks_failed = 0

    def collect(self) -> dict:
        """Snapshot and reset the counters (called by a collector/beat task)."""
        snapshot = self.snapshot()
        self.reset()
        logger.info("metrics snapshot=%s", json.dumps(snapshot, default=str))
        return snapshot


emissions = Emissions()


class AlertNotifier:
    """Best-effort alert dispatch to webhook and/or email plus the log stream.

    Configure with environment variables:

    - ``ALERT_WEBHOOK_URL``: POST a JSON payload. The payload contains an
      ``alert`` object with ``level``, ``title``, ``message``, ``service``.
    - ``ALERT_EMAILS``: comma-separated recipients; requires a configured
      ``EMAIL_HOST``. Uses Django's mail framework and never fails the request.
    """

    service_name = "rydepus-backend"

    def _webhook(self, payload: dict) -> None:
        url = getattr(settings, "ALERT_WEBHOOK_URL", "").strip()
        if not url:
            return
        try:
            request = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5):  # nosec B310 - webhook URL comes from server settings, not user input
                pass
        except (urllib.error.URLError, ValueError, OSError) as exc:
            logger.warning("alert_webhook_failed url=%s error=%s", url, exc)

    def _email(self, level: str, title: str, message: str) -> None:
        recipients = [r.strip() for r in getattr(settings, "ALERT_EMAILS", "").split(",") if r.strip()]
        if not recipients:
            return
        try:
            from django.core.mail import send_mail

            send_mail(
                subject=f"[{self.service_name}] {level.upper()} - {title}",
                message=message,
                from_email=None,
                recipient_list=recipients,
                fail_silently=True,
            )
        except Exception:  # noqa: BLE001 - alerting must never crash the caller
            logger.exception("alert_email_failed")

    def notify(self, level: str, title: str, message: str) -> None:
        """Dispatch an alert. ``level`` is one of info|warning|critical."""
        payload = {
            "alert": {
                "level": level,
                "title": title,
                "message": message,
                "service": self.service_name,
                "version": 1,
            }
        }
        log = getattr(logger, {"info": "info", "warning": "warning", "critical": "critical"}.get(level, "warning"))
        log("alert level=%s title=%s message=%s", level, title, message)
        self._webhook(payload)
        self._email(level, title, message)


alerter = AlertNotifier()
