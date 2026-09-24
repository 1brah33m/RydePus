import logging

from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.error_tracking import capture_exception
from config.errors import PERMISSION_DENIED, SERVER_ERROR, build_error

logger = logging.getLogger("campus_keke.errors")


class HealthView(APIView):
    """Unauthenticated liveness check (database only).

    Response::

        {"status": "ok"}
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    schema = None  # exclude from OpenAPI docs

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            # Never leak database driver details to unauthenticated callers.
            logger.exception("Health check database probe failed")
            response = Response(
                {"status": "error", "detail": "database unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            response.headers["Cache-Control"] = "no-store"
            return response
        response = Response({"status": "ok"})
        response.headers["Cache-Control"] = "no-store"
        return response


class ReadinessView(APIView):
    """Unauthenticated readiness check for load balancer / orchestrators.

    Verifies the database and, when Redis is reachable, the cache. Workers are
    probed by their heartbeat/beat tasks rather than here so a single worker
    stop does not remove a perfectly healthy web node. Always returns
    ``Cache-Control: no-store``.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    schema = None  # exclude from OpenAPI docs

    def get(self, request):
        checks: dict[str, str] = {}

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception:
            logger.exception("Readiness database probe failed")
            checks["database"] = "error"

        from django.conf import settings as dj_settings

        try:
            import redis as redis_client

            client = redis_client.Redis.from_url(dj_settings.REDIS_URL, socket_timeout=2)
            client.ping()
            checks["redis"] = "ok"
        except Exception:
            redis_error = "error" if dj_settings.REDIS_REQUIRED else "unavailable"
            checks["redis"] = redis_error

        degraded = [name for name, state in checks.items() if state == "error"]
        response_body = {"status": "ok" if not degraded else "degraded", "checks": checks}
        response = Response(
            response_body,
            status=status.HTTP_200_OK if not degraded else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        response.headers["Cache-Control"] = "no-store"
        return response


def api_404(request, exception=None):
    """Django-level 404 handler returning the shared JSON error format."""
    return JsonResponse(
        build_error("NOT_FOUND", "The requested resource was not found.", request=request),
        status=status.HTTP_404_NOT_FOUND,
    )


def api_403(request, exception=None):
    """Django-level 403 handler returning the shared JSON error format."""
    return JsonResponse(
        build_error(
            PERMISSION_DENIED,
            "You do not have permission to perform this action.",
            request=request,
        ),
        status=status.HTTP_403_FORBIDDEN,
    )


def api_500(request):
    """Django-level 500 handler returning a safe, non-leaking error body."""
    logger.exception("Unhandled server error")
    capture_exception(Exception("Unhandled server error (Django 500 handler)"))
    return JsonResponse(
        build_error(
            SERVER_ERROR,
            "An unexpected error occurred. Please try again later.",
            request=request,
        ),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
