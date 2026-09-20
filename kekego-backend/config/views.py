import logging

from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger("campus_keke.errors")


class HealthView(APIView):
    """Unauthenticated liveness check.

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
        except Exception as exc:  # pragma: no cover - depends on infra health
            return Response(
                {"status": "error", "detail": "database unavailable", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"status": "ok"})


def api_404(request, exception=None):
    """Django-level 404 handler returning the shared JSON error format."""
    return JsonResponse(
        {"error": {"code": "NOT_FOUND", "message": "The requested resource was not found."}},
        status=status.HTTP_404_NOT_FOUND,
    )


def api_403(request, exception=None):
    """Django-level 403 handler returning the shared JSON error format."""
    return JsonResponse(
        {"error": {"code": "PERMISSION_DENIED", "message": "You do not have permission to perform this action."}},
        status=status.HTTP_403_FORBIDDEN,
    )


def api_500(request):
    """Django-level 500 handler returning a safe, non-leaking error body."""
    logger.exception("Unhandled server error")
    return JsonResponse(
        {"error": {"code": "SERVER_ERROR", "message": "An unexpected error occurred. Please try again later."}},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )