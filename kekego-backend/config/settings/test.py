"""Test settings used by pytest (see ``pytest.ini``).

Tests run against an in-memory SQLite database and Celery is forced into
eager mode so no external services are required.
"""

from .development import *  # noqa: F401, F403
from .development import BASE_DIR, env

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

CELERY_TASK_ALWAYS_EAGER = True

REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"anon": "10000/minute", "user": "10000/minute"}

# Django's default PBKDF2 hasher (720k iterations) costs ~10s per password
# check on this machine, which makes the suite hang. MD5 is fine for tests.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Keep test output quiet.
LOGGING["root"]["level"] = "WARNING"
LOGGING["loggers"]["campus_keke"]["level"] = "WARNING"

# Literal marker so linters/IDEs do not think the import is unused.
_ = (BASE_DIR, env)