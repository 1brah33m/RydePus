"""Reusable, role-based DRF permission classes.

Security is enforced here on the backend, never by the frontend.
"""

from rest_framework.permissions import BasePermission

from apps.users.models import User


class IsStudent(BasePermission):
    """Only allow authenticated users whose role is STUDENT."""

    message = "This endpoint is only available to student users."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.STUDENT)


class IsDriver(BasePermission):
    """Only allow authenticated users whose role is DRIVER."""

    message = "This endpoint is only available to driver users."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.DRIVER)