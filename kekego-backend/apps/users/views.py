from django.contrib.auth import authenticate
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.authentication import BearerHeaderAuthenticator
from apps.users.serializers import (
    ChangePasswordSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)
from apps.users.tokens import get_tokens_for_user


def _auth_response(user) -> dict:
    return {"user": UserSerializer(user).data, **get_tokens_for_user(user)}


class RegisterView(APIView):
    """POST /api/v1/auth/register/ - create a STUDENT or DRIVER account."""

    authentication_classes = [BearerHeaderAuthenticator]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(_auth_response(user), status=status.HTTP_201_CREATED)


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


class MeView(APIView):
    """GET /api/v1/auth/me/ - return the currently authenticated user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/ - update a signed-in user's password."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password changed successfully."})