"""Canonical API error contract for the Campus Keke / Rydepus backend.

Every HTTP error has the shape::

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Human readable message",
        "request_id": "a1b2c3d4"     # present when a request context exists
      },
      "errors": { "field": ["detail"] }   # optional, field-level details
    }

``errors`` is only added when the caller can usefully act on field-level
details (DRF validation errors). It is never added for 5xx responses.
"""

from rest_framework import status as http_status
from rest_framework.response import Response

# Canonical public error codes. These are part of the API contract and are
# documented in ``API_CONTRACT.md``. Do not rename without a breaking release.
VALIDATION_ERROR = "VALIDATION_ERROR"
AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
PERMISSION_DENIED = "PERMISSION_DENIED"
NOT_FOUND = "NOT_FOUND"
METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
THROTTLED = "THROTTLED"
CONFLICT = "CONFLICT"
INVALID_STATE = "INVALID_STATE"
DUPLICATE = "DUPLICATE"
PAYMENT_PROVIDER_ERROR = "PAYMENT_PROVIDER_ERROR"
INVALID_SIGNATURE = "INVALID_SIGNATURE"
INVALID_PAYLOAD = "INVALID_PAYLOAD"
SERVER_ERROR = "SERVER_ERROR"

ALL_CODES = frozenset(
    {
        VALIDATION_ERROR,
        AUTHENTICATION_FAILED,
        NOT_AUTHENTICATED,
        PERMISSION_DENIED,
        NOT_FOUND,
        METHOD_NOT_ALLOWED,
        THROTTLED,
        CONFLICT,
        INVALID_STATE,
        DUPLICATE,
        PAYMENT_PROVIDER_ERROR,
        INVALID_SIGNATURE,
        INVALID_PAYLOAD,
        SERVER_ERROR,
    }
)


def request_id_for(request) -> str:
    """Best-effort request id from ``request.request_id`` or the header."""
    request_id = getattr(request, "request_id", None)
    if request_id:
        return request_id
    request_id = getattr(getattr(request, "_request", None), "request_id", None)
    return request_id or ""


def build_error(code: str, message: str, *, request=None, errors=None, request_id: str | None = None) -> dict:
    """Build the canonical error envelope."""
    payload = {"code": code, "message": message}
    request_id = request_id or request_id_for(request)
    if request_id:
        payload["request_id"] = request_id
    body = {"error": payload}
    if errors:
        body["errors"] = errors
    return body


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    request=None,
    errors=None,
) -> Response:
    """Return a DRF ``Response`` in the canonical error shape."""
    return Response(build_error(code, message, request=request, errors=errors), status=status_code)


def http_code(status_code: int) -> str:
    """Map an HTTP status to the canonical code used by the 4xx/5xx handlers."""
    return {
        http_status.HTTP_400_BAD_REQUEST: VALIDATION_ERROR,
        http_status.HTTP_401_UNAUTHORIZED: NOT_AUTHENTICATED,
        http_status.HTTP_403_FORBIDDEN: PERMISSION_DENIED,
        http_status.HTTP_404_NOT_FOUND: NOT_FOUND,
        http_status.HTTP_405_METHOD_NOT_ALLOWED: METHOD_NOT_ALLOWED,
        http_status.HTTP_409_CONFLICT: CONFLICT,
        http_status.HTTP_429_TOO_MANY_REQUESTS: THROTTLED,
        http_status.HTTP_500_INTERNAL_SERVER_ERROR: SERVER_ERROR,
        http_status.HTTP_502_BAD_GATEWAY: PAYMENT_PROVIDER_ERROR,
    }.get(status_code, "API_ERROR")
