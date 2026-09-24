"""Consistent API error format for the Campus Keke project.

Every HTTP error produced by the API is returned as::

    {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Human readable message",
            "request_id": "a1b2c3d4"
        },
        "errors": { "field": ["detail"] }   # optional, DRF validation only
    }

Internal server errors never leak tracebacks or sensitive details to clients;
they are logged server-side and forwarded to the configured error tracker.
"""

import logging

from django.conf import settings
from rest_framework.views import exception_handler

from config.error_tracking import capture_exception
from config.errors import SERVER_ERROR, build_error

logger = logging.getLogger("campus_keke.errors")


def _flatten_message(detail) -> str:
    """Flatten nested DRF validation details into a single readable string."""
    if isinstance(detail, dict):
        if not detail:
            return "Invalid request."
        return _flatten_message(next(iter(detail.values())))
    if isinstance(detail, (list, tuple)):
        if not detail:
            return "Invalid request."
        return _flatten_message(detail[0])
    return str(detail)


def _error_code(exc: Exception) -> str:
    default_code = getattr(exc, "default_code", None)
    return (str(default_code).upper() or "API_ERROR") if default_code else "API_ERROR"


def api_exception_handler(exc: Exception, context: dict) -> object | None:
    """DRF exception handler that wraps every error in the shared format."""
    response = exception_handler(exc, context)

    # Not an exception DRF knows about (e.g. an unhandled bug).
    if response is None:
        logger.exception("Unhandled exception in API view", exc_info=exc)
        capture_exception(exc)
        if settings.DEBUG:
            # Let Django render its debug page during development.
            return None
        from rest_framework import status
        from rest_framework.response import Response

        request = context.get("request")
        return Response(
            build_error(
                SERVER_ERROR,
                "An unexpected error occurred. Please try again later.",
                request=request,
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = getattr(exc, "detail", "Request failed.")
    field_errors = detail if isinstance(detail, dict) else None
    request = context.get("request")
    response.data = {
        "error": build_error(
            _error_code(exc),
            _flatten_message(detail),
            request=request,
        )["error"],
    }
    if field_errors:
        response.data["errors"] = {
            str(field): (messages if isinstance(messages, list) else [str(messages)])
            for field, messages in field_errors.items()
        }
    return response
