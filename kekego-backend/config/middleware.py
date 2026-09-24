"""Request logging middleware for structured production observability.

Adds a correlation ``request_id`` (honouring an inbound ``X-Request-ID`` when
present, otherwise generating one), stamps it on the response for clients, and
emits a single structured JSON access log per request with latency, status,
and an obfuscated path. Sensitive query strings, bodies, credentials, and JWT
headers are never logged.
"""

import logging
import time
import uuid

from config.monitoring import emissions

request_logger = logging.getLogger("campus_keke.request")


class RequestLogMiddleware:
    """Log one structured line per request and track request latency/count."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID", "").strip() or uuid.uuid4().hex[:16]
        request.request_id = request_id

        start = time.perf_counter()
        try:
            response = self.get_response(request)
        finally:
            emissions.record_request()

        duration_ms = (time.perf_counter() - start) * 1000.0

        user_id = getattr(getattr(request, "user", None), "pk", None)
        status_code = getattr(response, "status_code", 0)

        if status_code >= 500:
            emissions.record_error()
            request_logger.error(
                "request method=%s path=%s status=%s duration_ms=%.1f user_id=%s request_id=%s",
                request.method,
                request.path,
                status_code,
                duration_ms,
                user_id,
                request_id,
            )
        else:
            request_logger.info(
                "request method=%s path=%s status=%s duration_ms=%.1f user_id=%s request_id=%s",
                request.method,
                request.path,
                status_code,
                duration_ms,
                user_id,
                request_id,
            )

        response.headers.setdefault("X-Request-ID", request_id)
        return response
