import json
import subprocess
import sys
from pathlib import Path

import pytest

from django.conf import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
HEALTH_URL = "/api/v1/health/"


@pytest.mark.django_db
def test_health_check_returns_ok_without_authentication(api_client):
    response = api_client.get(HEALTH_URL)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_health_check_does_not_leak_database_error_details(api_client, monkeypatch):
    from config import views as config_views

    class BoomCursor:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def execute(self, sql):
            raise RuntimeError("psycopg OperationalError: password=supersecret host=db.internal")

    monkeypatch.setattr(config_views.connection, "cursor", lambda: BoomCursor())

    response = api_client.get(HEALTH_URL)
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "error"
    assert body["detail"] == "database unavailable"
    assert "message" not in body
    assert "supersecret" not in json.dumps(body)


@pytest.mark.django_db
def test_docs_endpoint_is_served_under_development_settings(api_client):
    assert settings.ENABLE_API_DOCS is True
    response = api_client.get("/api/schema/")
    assert response.status_code == 200
    assert b"openapi:" in response.content


@pytest.mark.django_db
def test_unknown_route_uses_consistent_error_format(api_client):
    response = api_client.get("/api/v1/does-not-exist/")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"]


def _production_import_code(overrides):
    env_lines = "\n".join(f'    {key!r}: {value!r},' for key, value in overrides.items())
    return "\n".join(
        [
            "import os",
            "os.environ.update({",
            env_lines,
            "})",
            "try:",
            "    import config.settings.production as p",
            "except Exception:",
            "    import traceback",
            "    traceback.print_exc()",
            "    raise SystemExit(3)",
            'print("DOCS", p.ENABLE_API_DOCS)',
            'print("DEBUG", p.DEBUG)',
            'print("PAYMENT_PROVIDER", p.PAYMENT_PROVIDER)',
        ]
    )


def _import_production(overrides):
    return subprocess.run(
        [sys.executable, "-c", _production_import_code(overrides)],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=90,
    )


def test_production_settings_lock_down_docs_debug_and_require_hosts():
    base_env = {
        "DJANGO_SECRET_KEY": "test-secret-key",
        "DJANGO_DEBUG": "False",
        "DJANGO_ALLOWED_HOSTS": "api.example.com",
        "PAYMENT_PROVIDER": "manual",
        "DATABASE_URL": "postgres://user:pass@localhost:5432/campus_keke",
    }

    ok = _import_production(base_env)
    assert ok.returncode == 0, ok.stderr
    assert "DOCS False" in ok.stdout
    assert "DEBUG False" in ok.stdout
    assert "PAYMENT_PROVIDER manual" in ok.stdout

    missing_hosts = _import_production({**base_env, "DJANGO_ALLOWED_HOSTS": ""})
    assert missing_hosts.returncode == 3
    assert "ImproperlyConfigured" in missing_hosts.stderr