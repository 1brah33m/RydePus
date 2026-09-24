"""Base settings shared by every environment.

Configuration values come from environment variables (or a ``.env`` file at
the project root). No credentials or secrets are hardcoded here.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

from config.logging_conf import build_logging

# backend root (contains manage.py, apps/, config/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, False),
    DJANGO_SECRET_KEY=(str, ""),
)


def _read_env() -> None:
    """Read the project-level ``.env`` file once after the env parser exists."""
    environ.Env.read_env(BASE_DIR / ".env")


_read_env()

DEBUG = env("DJANGO_DEBUG")

SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in the environment or .env file.")

ALLOWED_HOSTS = [
    h.strip() for h in env("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1,testserver").split(",") if h.strip()
]


def resolve_allowed_hosts(*, required: bool) -> list[str]:
    """Parse ``DJANGO_ALLOWED_HOSTS`` into a list.

    When ``required`` is True (production) an empty value is a hard
    configuration error so deployments fail fast instead of serving under a
    misleading default.
    """
    hosts = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", default="").split(",") if h.strip()]
    if required and not hosts:
        raise ImproperlyConfigured("Production requires DJANGO_ALLOWED_HOSTS to be set.")
    return hosts


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    # Local apps
    "apps.users",
    "apps.drivers",
    "apps.groups",
    "apps.trips",
    "apps.payments",
    "apps.notifications",
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Structured request logging + correlation ids. Last so it can observe the
    # final response status of the whole chain.
    "config.middleware.RequestLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def resolve_databases() -> dict | None:
    """Build the DATABASES dict from environment variables.

    Priority:
    1. ``DATABASE_URL`` (django-environ URL form) if set
    2. ``DATABASE_*`` variables if ``DATABASE_HOST`` is set (PostgreSQL)
    3. return ``None`` otherwise (environment decides: dev falls back to SQLite,
       production raises).
    """
    database_url = env.str("DATABASE_URL", default="").strip()
    if database_url:
        return {"default": env.db_url("DATABASE_URL")}

    host = env.str("DATABASE_HOST", default="").strip()
    if not host:
        return None

    return {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env.str("DATABASE_NAME", default="campus_keke"),
            "USER": env.str("DATABASE_USER", default="campus_keke"),
            "PASSWORD": env.str("DATABASE_PASSWORD", default=""),
            "HOST": host,
            "PORT": env.int("DATABASE_PORT", default=5432),
            "CONN_MAX_AGE": env.int("DATABASE_CONN_MAX_AGE", default=60),
        }
    }


_database_config = resolve_databases()
if _database_config:
    DATABASES = _database_config

# ---------------------------------------------------------------------------
# Custom user model
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "users.User"

# ---------------------------------------------------------------------------
# Authentication / passwords
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("apps.users.authentication.PasswordAwareJWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    # URL-based API versioning ("/api/v1/") is the primary contract; the
    # schema pins the current major version.
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("DRF_THROTTLE_ANON", default="30/minute"),
        "user": env("DRF_THROTTLE_USER", default="120/minute"),
    },
}

# ---------------------------------------------------------------------------
# SimpleJWT (access/refresh token pairs)
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_MINUTES", default=60)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
}

# ---------------------------------------------------------------------------
# drf-spectacular (OpenAPI / Swagger / Redoc)
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "Rydepus / Campus Keke API",
    "DESCRIPTION": (
        "REST API for the campus keke transportation platform. Every error is "
        "returned in the documented envelope `{error: {code, message, request_id}}` "
        "with optional field-level `errors`. See API_CONTRACT.md for the full "
        "contract including pagination and error codes."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"BearerAuth": []}],
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
    "TAGS": [
        {"name": "auth", "description": "Registration, login, tokens, profile."},
        {"name": "drivers", "description": "Driver profiles and availability."},
        {"name": "groups", "description": "Student ride groups and memberships."},
        {"name": "trips", "description": "Trip lifecycle and ratings."},
        {"name": "payments", "description": "Payments, refunds, webhooks."},
        {"name": "notifications", "description": "User notifications."},
        {"name": "platform", "description": "Health, docs, platform endpoints."},
    ],
}

# ---------------------------------------------------------------------------
# CORS (used by the React PWA frontend)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [o.strip() for o in env("DJANGO_CORS_ALLOWED_ORIGINS", default="").split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
# ``manual`` records intents without talking to a provider (dev/tests only).
# Production defaults to ``paystack`` (see ``config.settings.production``).
PAYMENT_PROVIDER = env("PAYMENT_PROVIDER", default="manual")
PAYSTACK_SECRET_KEY = env("PAYSTACK_SECRET_KEY", default="")
PAYSTACK_WEBHOOK_SECRET = env("PAYSTACK_WEBHOOK_SECRET", default="")
# Server-side unit price used to price group buyouts. Buyout amounts are never
# accepted from the client; a zero value disables buyouts until configured.
GROUP_SEAT_FARE = env.float("GROUP_SEAT_FARE", default=0)

# ---------------------------------------------------------------------------
# API documentation (schema/Swagger/Redoc). Off by default in production.
# ---------------------------------------------------------------------------
ENABLE_API_DOCS = False

# ---------------------------------------------------------------------------
# Redis / Celery
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6379/0")
# Readiness treats Redis as critical when True (production); development and
# tests can run without a live Redis.
REDIS_REQUIRED = env.bool("REDIS_REQUIRED", default=False)

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=REDIS_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True
# Durable delivery: acknowledge only after the task body completes so a worker
# crash retries rather than silently losing work.
CELERY_TASK_ACKS_LATE = env.bool("CELERY_TASK_ACKS_LATE", default=True)
CELERY_WORKER_PREFETCH_MULTIPLIER = env.int("CELERY_WORKER_PREFETCH_MULTIPLIER", default=4)
CELERY_TASK_TIME_LIMIT = env.int("CELERY_TASK_TIME_LIMIT", default=300)
CELERY_TASK_SOFT_TIME_LIMIT = env.int("CELERY_TASK_SOFT_TIME_LIMIT", default=240)
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_RESULT_EXPIRES = env.int("CELERY_RESULT_EXPIRES", default=86400)
CELERY_BEAT_SCHEDULE_FILENAME = BASE_DIR / "celerybeat-schedule"

# ---------------------------------------------------------------------------
# Monitoring / alerting / error tracking
# ---------------------------------------------------------------------------
SENTRY_DSN = env("SENTRY_DSN", default="")
ALERT_WEBHOOK_URL = env("ALERT_WEBHOOK_URL", default="")
ALERT_EMAILS = env("ALERT_EMAILS", default="")
RYDEPUS_RELEASE = env("RYDEPUS_RELEASE", default="")

# ---------------------------------------------------------------------------
# Admin URL (kept secret in production by renaming the route). Never expose
# /admin/ at a guessable path when DJANGO_ADMIN_URL is customized.
# ---------------------------------------------------------------------------
ADMIN_URL = env("DJANGO_ADMIN_URL", default="admin/").strip("/")
if not ADMIN_URL:
    raise ImproperlyConfigured("DJANGO_ADMIN_URL cannot be empty.")

# ---------------------------------------------------------------------------
# Backups
# ---------------------------------------------------------------------------
BACKUP_DIR = BASE_DIR / env("BACKUP_DIR", default="backups")

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = build_logging(debug=DEBUG)
