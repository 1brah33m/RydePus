"""Production settings: locked-down security and HTTPS-ready defaults."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403
from .base import env, resolve_databases

DEBUG = False

# Allowed hosts must be explicit in production.
ALLOWED_HOSTS = [
    h.strip()
    for h in env("DJANGO_ALLOWED_HOSTS", default="").split(",")
    if h.strip()
]

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