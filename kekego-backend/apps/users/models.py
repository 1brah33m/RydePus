from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user identified by email with a STUDENT or DRIVER role.

    Role is immutable through the public API (see ``users.serializers``); it
    can only be set at registration time.
    """

    class Role(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        DRIVER = "DRIVER", "Driver"

    class RegistrationSource(models.TextChoices):
        """How the account's identity was established at sign-up."""

        MANUAL = "MANUAL", "Email and password"
        GOOGLE = "GOOGLE", "Google account"

    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True, default="")
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    registration_source = models.CharField(
        max_length=10,
        choices=RegistrationSource.choices,
        default=RegistrationSource.MANUAL,
    )
    #: Google's stable per-account id (``sub``). Only set for Google sign-ups,
    #: and unique so one Google account cannot be linked twice.
    google_sub = models.CharField(max_length=255, null=True, blank=True, unique=True)
    #: When the password was last changed, so stale sessions can be rejected.
    password_changed_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.email