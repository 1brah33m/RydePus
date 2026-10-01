from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.users.google import GoogleIdentityError, resolve_google_identity
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    """Representation of a user returned by the API.

    ``role`` is read-only: users can never change their own role through a
    profile update; it is fixed at registration time. ``registration_source``
    is read-only for the same reason — it records how the account was created.
    """

    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "phone_number",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "registration_source",
            "created_at",
        )
        read_only_fields = ("id", "role", "registration_source", "created_at")


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Update editable profile fields for the current authenticated user."""

    class Meta:
        model = User
        fields = ("first_name", "last_name", "phone_number")


def _clean_name_field(value: str) -> str:
    return " ".join(value.split())[:150]


class ChangePasswordSerializer(serializers.Serializer):
    """Validate current-password and new-password updates for the authenticated user."""

    old_password = serializers.CharField(write_only=True, required=True, trim_whitespace=False)
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
        min_length=settings.PASSWORD_MIN_LENGTH,
    )

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"old_password": "The old password is incorrect."})

        validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class RegisterSerializer(serializers.Serializer):
    """Payload used when creating a STUDENT or DRIVER account.

    A password is always required and must be confirmed. The name may be typed
    by the user, or taken from a verified Google ID token — in which case the
    token's ``given_name``/``family_name`` win, because a client cannot be
    trusted to report its own identity.
    """

    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
        min_length=settings.PASSWORD_MIN_LENGTH,
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
        style={"input_type": "password"},
        help_text="Must match password.",
    )
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    role = serializers.ChoiceField(choices=User.Role.choices)
    #: A Google ID token. When present the identity is verified server-side and
    #: the account is recorded as Google-linked.
    google_id_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=True,
        help_text="Google ID token; when supplied, the Google name and email are used.",
    )

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        # Google first: a verified identity can fill the blank name fields.
        google_sub = None
        if attrs.get("google_id_token"):
            try:
                identity = resolve_google_identity(attrs["google_id_token"])
            except GoogleIdentityError as exc:
                raise serializers.ValidationError({"google_id_token": str(exc)}) from exc

            if identity["email"] != attrs["email"]:
                raise serializers.ValidationError(
                    {"email": "That Google account uses a different email address."}
                )
            if User.objects.filter(google_sub=identity["google_sub"]).exclude(email=attrs["email"]).exists():
                raise serializers.ValidationError(
                    {"google_id_token": "That Google account is already linked to another user."}
                )

            attrs["first_name"] = identity["first_name"]
            attrs["last_name"] = identity["last_name"]
            google_sub = identity["google_sub"]

        first_name = _clean_name_field(attrs.get("first_name") or "")
        last_name = _clean_name_field(attrs.get("last_name") or "")
        if not first_name:
            raise serializers.ValidationError({"first_name": "Enter your first name."})
        if not last_name:
            raise serializers.ValidationError(
                {"last_name": "Enter your last name, or link a Google account to fill it in."}
            )

        if attrs["confirm_password"] != attrs["password"]:
            raise serializers.ValidationError({"confirm_password": "The two passwords do not match."})

        # Run Django's validators (minimum length, common/numeric passwords,
        # similarity to the user's own name or email) against a throwaway user.
        candidate = User(
            email=attrs["email"],
            first_name=first_name,
            last_name=last_name,
        )
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        attrs["first_name"] = first_name
        attrs["last_name"] = last_name
        attrs["google_sub"] = google_sub
        return attrs

    def create(self, validated_data: dict) -> User:
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        role = validated_data.pop("role")
        # Write-only request fields that must never reach the model.
        validated_data.pop("confirm_password", None)
        validated_data.pop("google_id_token", None)
        google_sub = validated_data.pop("google_sub", None)

        user = User.objects.create_user(
            email=email,
            password=password,
            role=role,
            registration_source=User.RegistrationSource.GOOGLE if google_sub else User.RegistrationSource.MANUAL,
            google_sub=google_sub,
            **validated_data,
        )
        return user
