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


class IsVerifiedDriver(BasePermission):
    """Allow drivers whose identity has been verified by a staff member.

    Public registration creates DRIVER accounts that are unverified; they can
    authenticate but can never operate (go online, view/accept/track trips,
    or manage availability) until an administrator approves the profile.
    """

    message = "Your driver account has not been verified yet."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.role == User.Role.DRIVER):
            return False
        profile = getattr(user, "driver_profile", None)
        return bool(profile and profile.is_verified)
