"""Development settings: relaxed security, permissive CORS, SQLite fallback."""

from .base import *  # noqa: F401, F403
from .base import BASE_DIR, env, resolve_databases

DEBUG = True

# Local dev convenience: permissive CORS so the Vite dev server can call us.
CORS_ALLOW_ALL_ORIGINS = True

# ---------------------------------------------------------------------------
# Database: use the environment config if present, otherwise fall back to a
# local SQLite file so `python manage.py runserver` works out of the box
# without installing PostgreSQL.
# ---------------------------------------------------------------------------
_database_config = resolve_databases()
if _database_config:
    DATABASES = _database_config
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }