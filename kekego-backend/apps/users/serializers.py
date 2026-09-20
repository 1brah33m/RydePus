from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    """Representation of a user returned by the API.

    ``role`` is read-only: users can never change their own role through a
    profile update; it is fixed at registration time.
    """

    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone_number", "first_name", "last_name", "full_name", "role", "created_at")
        read_only_fields = ("id", "role", "created_at")


class RegisterSerializer(serializers.Serializer):
    """Payload used when creating a STUDENT or DRIVER account."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data: dict) -> User:
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        role = validated_data.pop("role")
        return User.objects.create_user(email=email, password=password, role=role, **validated_data)