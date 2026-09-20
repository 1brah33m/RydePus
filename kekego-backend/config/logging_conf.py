"""Structured logging configuration for the Campus Keke project.

Development uses a human-friendly console formatter.
Production uses a JSON-structured formatter that is easy to ship to log
collectors (CloudWatch, ELK, Loki, ...).

Sensitive data (passwords, JWT tokens, ...) is never logged.
"""

import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Log records as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.args:
            payload["extra"] = str(record.args)
        return json.dumps(payload, default=str)


def build_logging(debug: bool) -> dict:
    """Return the ``LOGGING`` dict for the requested environment."""
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "console": {
                "format": "{levelname} {asctime} {name}: {message}",
                "style": "{",
            },
            "json": {"()": "config.logging_conf.JsonFormatter"},
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json" if not debug else "console",
            },
        },
        "root": {"handlers": ["console"], "level": "DEBUG" if debug else "INFO"},
        "loggers": {
            "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
            "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
            "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
            "django.db.backends": {"handlers": ["console"], "level": "WARNING", "propagate": False},
            "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
            "celery.task": {"handlers": ["console"], "level": "INFO", "propagate": False},
            "campus_keke": {"handlers": ["console"], "level": "DEBUG" if debug else "INFO", "propagate": False},
        },
    }