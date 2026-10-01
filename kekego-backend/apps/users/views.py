from django.contrib.auth import authenticate
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.authentication import BearerHeaderAuthenticator
from apps.users.google import GoogleIdentityError, resolve_google_identity
from apps.users.serializers import (
    ChangePasswordSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)
from apps.users.tokens import get_tokens_for_user


def _auth_response(user) -> dict:
    return {"user": UserSerializer(user).data, **get_tokens_for_user(user)}


# ---------------------------------------------------------------------------
# drf-spectacular schema pieces for the auth endpoints
# ---------------------------------------------------------------------------

class AuthResponseSerializer(serializers.Serializer):
    """The shared register/login response: user metadata + JWT token pair."""

    user = UserSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


login_request = inline_serializer(
    "LoginRequest",
    fields={
        "email": serializers.EmailField(),
        "password": serializers.CharField(write_only=True),
    },
)

refresh_response = inline_serializer(
    "RefreshResponse",
    fields={"access": serializers.CharField()},
)

google_identity_request = inline_serializer(
    "GoogleIdentityRequest",
    fields={
        "id_token": serializers.CharField(
            help_text="The Google ID token returned by the browser sign-in flow.",
        ),
    },
)

google_identity_response = inline_serializer(
    "GoogleIdentityResponse",
    fields={
        "email": serializers.EmailField(),
        "first_name": serializers.CharField(),
        "last_name": serializers.CharField(),
    },
)

password_change_response = inline_serializer(
    "PasswordChangeResponse",
    fields={"detail": serializers.CharField()},
)


@extend_schema(
    summary="Register a student or driver account",
    description="Creates a STUDENT or DRIVER account. Role is fixed at "
    "registration; callers cannot self-assign staff/superuser flags. A password "
    "is required and must be repeated in confirm_password. Names may be typed "
    "by the user, or auto-filled by sending google_id_token, in which case the "
    "verified Google given_name/family_name are stored instead.",
    request=RegisterSerializer,
    responses={
        201: AuthResponseSerializer,
        400: OpenApiResponse(
            description="Validation error (duplicate email, weak password, "
            "mismatched confirmation, missing name, unknown role)."
        ),
    },
)
class RegisterView(APIView):
    """POST /api/v1/auth/register/ - create a STUDENT or DRIVER account."""

    authentication_classes = [BearerHeaderAuthenticator]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(_auth_response(user), status=status.HTTP_201_CREATED)


@extend_schema(
    summary="Resolve a Google account to a sign-up name",
    description="Verifies a Google ID token server-side and returns only the "
    "email and the first/last name, so the registration form can be pre-filled "
    "without the user typing it. The rest of the Google profile is discarded. "
    "Requires GOOGLE_OAUTH_CLIENT_ID to be configured on the server.",
    request=google_identity_request,
    responses={
        200: google_identity_response,
        400: OpenApiResponse(description="The token is missing, invalid, or Google sign-in is disabled."),
    },
)
class GoogleIdentityView(APIView):
    """POST /api/v1/auth/google/identity/ - verified Google name for sign-up."""

    authentication_classes = [BearerHeaderAuthenticator]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = (request.data.get("id_token") or "").strip()
        try:
            identity = resolve_google_identity(id_token)
        except GoogleIdentityError as exc:
            return Response(
                {"error": {"code": "INVALID", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "email": identity["email"],
                "first_name": identity["first_name"],
                "last_name": identity["last_name"],
            }
        )


@extend_schema(
    summary="Log in with email and password",
    description="Exchanges email + password for an access/refresh JWT pair plus the user profile.",
    request=login_request,
    responses={
        200: AuthResponseSerializer,
        401: OpenApiResponse(description="Invalid email or password."),
    },
)
class LoginView(APIView):
    """POST /api/v1/auth/login/ - exchange email + password for JWT tokens."""

    authentication_classes = [BearerHeaderAuthenticator]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        user = authenticate(request=request, email=email, password=password)
        if user is None or not user.is_active:
            raise AuthenticationFailed("Invalid email or password.")

        return Response(_auth_response(user))


@extend_schema_view(
    post=extend_schema(
        summary="Refresh the access token",
        description="Exchanges a valid refresh token for a fresh access token.",
        request=TokenRefreshSerializer,
        responses={
            200: refresh_response,
            401: OpenApiResponse(description="The refresh token is missing or invalid."),
        },
    )
)
class RefreshView(TokenRefreshView):
    """POST /api/v1/auth/refresh/ - issued through SimpleJWT."""


@extend_schema_view(
    get=extend_schema(
        summary="Current user profile",
        description="Returns the profile of the authenticated user.",
        responses={200: UserSerializer()},
    ),
    patch=extend_schema(
        summary="Update the current user profile",
        description="Updates the editable profile fields (names and phone). "
        "Role is immutable through this endpoint.",
        request=UserProfileUpdateSerializer,
        responses={
            200: UserSerializer(),
            400: OpenApiResponse(description="Validation error."),
        },
    ),
)
class MeView(APIView):
    """GET/PATCH /api/v1/auth/me/ - the authenticated user's profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


@extend_schema(
    summary="Change the current user's password",
    request=ChangePasswordSerializer,
    responses={
        200: password_change_response,
        400: OpenApiResponse(description="Wrong old password or a weak new password."),
    },
)
class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/ - update a signed-in user's password."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password changed successfully."})