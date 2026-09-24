"""Production settings: locked-down security and HTTPS-ready defaults."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403
from .base import env, resolve_allowed_hosts, resolve_databases

DEBUG = False

# Allowed hosts must be explicit and non-empty in production.
ALLOWED_HOSTS = resolve_allowed_hosts(required=True)

# A database MUST be configured in production.
_database_config = resolve_databases()
if not _database_config:
    raise ImproperlyConfigured(
        "Production requires PostgreSQL. Set DATABASE_URL or DATABASE_HOST/DATABASE_NAME/"
        "DATABASE_USER/DATABASE_PASSWORD environment variables."
    )
DATABASES = _database_config

# CORS must be an explicit list in production (never *).
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in env("DJANGO_CORS_ALLOWED_ORIGINS", default="").split(",")
    if o.strip()
]
CORS_ALLOW_ALL_ORIGINS = False

# ---------------------------------------------------------------------------
# HTTPS / security hardening
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=15552000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

X_FRAME_OPTIONS = "DENY"

# Admin / media served over HTTPS too; static files should be served by a
# reverse proxy or CDN in front of the app.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True

# ---------------------------------------------------------------------------
# Payments: real provider authorization is expected in production. The
# operator must explicitly choose a provider; a missing value is a
# configuration error rather than a silently unauthenticated fallback.
# ---------------------------------------------------------------------------
PAYMENT_PROVIDER = env("PAYMENT_PROVIDER", default="").strip().lower()
if not PAYMENT_PROVIDER:
    raise ImproperlyConfigured(
        "Production requires PAYMENT_PROVIDER to be set (e.g. 'paystack' or 'manual')."
    )
if PAYMENT_PROVIDER == "paystack":
    if not PAYSTACK_SECRET_KEY:
        raise ImproperlyConfigured("Production with PAYMENT_PROVIDER=paystack requires PAYSTACK_SECRET_KEY.")
    if not PAYSTACK_WEBHOOK_SECRET:
        raise ImproperlyConfigured("Production with PAYMENT_PROVIDER=paystack requires PAYSTACK_WEBHOOK_SECRET.")

# API docs (schema/Swagger/Redoc) are off unless explicitly enabled.
ENABLE_API_DOCS = env.bool("DJANGO_ENABLE_API_DOCS", default=False)