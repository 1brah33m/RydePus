"""Operational reliability: backups/restores, monitoring counters, alert
dispatch, structured request logging, and Celery task reliability."""

import sqlite3

import pytest
from django.core.management.base import CommandError

from apps.core.management.commands import backup_db as backup_module
from apps.core.management.commands import restore_db as restore_module
from apps.notifications.models import Notification
from apps.notifications.tasks import create_notification, retry_undelivered
from config.monitoring import alerter, emissions


# --------------------------------------------------------------------------
# Database backups and restore testing (SQLite round-trip)
# --------------------------------------------------------------------------
class _FakeSqliteConnection:
    vendor = "sqlite"
    settings_dict = {"NAME": None}


@pytest.fixture
def seeded_sqlite_file(tmp_path):
    db_file = tmp_path / "seed.sqlite"
    conn = sqlite3.connect(str(db_file))
    conn.execute("CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT)")
    conn.executemany(
        "INSERT INTO trips (name) VALUES (?)",
        [("Hostel run",), ("Market run",)],
    )
    conn.commit()
    seed_exists = conn.execute("SELECT COUNT(*) FROM trips").fetchone()[0]
    conn.close()
    assert seed_exists == 2
    return db_file


@pytest.fixture
def fake_sqlite_connection(seeded_sqlite_file):
    _FakeSqliteConnection.settings_dict["NAME"] = str(seeded_sqlite_file)
    return _FakeSqliteConnection()


def test_backup_then_restore_round_trip(tmp_path, fake_sqlite_connection, monkeypatch):
    monkeypatch.setattr(backup_module, "connection", fake_sqlite_connection)

    backup_path = tmp_path / "backup.sqlite"
    backup_cmd = backup_module.Command()
    backup_cmd.stdout = backup_cmd.stderr = open(tmp_path / "backup.out", "w")
    backup_cmd.handle(output=str(backup_path), quiet=True)

    assert backup_path.exists()
    assert backup_path.stat().st_size > 0

    restore_target = tmp_path / "restored.sqlite"
    monkeypatch.setattr(restore_module, "connection", _FakeSqliteConnection())
    restore_cmd = restore_module.Command()
    restore_cmd.stdout = restore_cmd.stderr = open(tmp_path / "restore.out", "w")
    restore_cmd.handle(input=str(backup_path), target=str(restore_target), yes=True)

    restored = sqlite3.connect(str(restore_target))
    count = restored.execute("SELECT COUNT(*) FROM trips").fetchone()[0]
    rows = restored.execute("SELECT name FROM trips ORDER BY id").fetchall()
    restored.close()

    assert count == 2
    assert ("Hostel run",) in rows and ("Market run",) in rows


def test_restore_refuses_destructive_overwrite(tmp_path, fake_sqlite_connection, monkeypatch):
    monkeypatch.setattr(backup_module, "connection", fake_sqlite_connection)
    backup_path = tmp_path / "backup.sqlite"
    backup_module.Command().handle(output=str(backup_path), quiet=True)

    target = tmp_path / "existing.sqlite"
    target.write_bytes(b"not a database")

    monkeypatch.setattr(restore_module, "connection", _FakeSqliteConnection())
    with pytest.raises(CommandError):
        restore_module.Command().handle(input=str(backup_path), target=str(target), yes=False)


# --------------------------------------------------------------------------
# Monitoring counters + alert dispatch
# --------------------------------------------------------------------------
def test_monitoring_counters_and_collect():
    emissions.reset()
    emissions.record_request()
    emissions.record_request()
    emissions.record_error()
    emissions.record_task_success()

    snapshot = emissions.snapshot()
    assert snapshot["requests"] == 2
    assert snapshot["errors"] == 1
    assert snapshot["tasks_succeeded"] == 1

    collected = emissions.collect()
    assert collected["requests"] == 2
    assert emissions.snapshot()["requests"] == 0


def test_alert_notifier_posts_webhook(caplog, monkeypatch, settings):
    posted = {}

    def fake_urlopen(request, timeout=0):
        posted["body"] = request.data
        posted["url"] = request.full_url
        return type("R", (), {"__enter__": lambda self: self, "__exit__": lambda *a: False, "read": lambda: b"{}"})()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    settings.ALERT_WEBHOOK_URL = "https://alerts.example.com/hook"

    alerter.notify("critical", "Test alert", "Something is wrong.")

    assert "Test alert" in posted["body"].decode()
    assert posted["url"] == "https://alerts.example.com/hook"


def test_alert_notifier_never_crashes_on_bad_webhook(caplog, monkeypatch, settings):
    def boom_urlopen(request, timeout=0):
        raise ValueError("network down")

    monkeypatch.setattr("urllib.request.urlopen", boom_urlopen)
    settings.ALERT_WEBHOOK_URL = "https://alerts.example.com/unreachable"

    alerter.notify("warning", "Test alert 2", "Still safe.")
    assert True


# --------------------------------------------------------------------------
# Structured request logging + correlation ids
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_request_logging_adds_correlation_id(api_client, caplog):
    response = api_client.get("/api/v1/health/")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) == 16


@pytest.mark.django_db
def test_error_envelope_includes_request_id_and_field_errors(student_client):
    response = student_client.post(
        "/api/v1/groups/",
        {"name": "", "pickup_location": "Gate", "destination": "Hostel", "capacity": 0},
        format="json",
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] in ("INVALID", "VALIDATION_ERROR")
    assert "request_id" in body["error"]
    assert "errors" in body


# --------------------------------------------------------------------------
# Celery task reliability
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_create_notification_marks_delivered(student_user):
    result = create_notification(student_user.id, "Trip update", "Your ride is ready.", "TRIP_UPDATE")
    notification = Notification.objects.get(pk=result["id"])
    assert notification.is_sent is True
    assert notification.sent_at is not None


@pytest.mark.django_db
def test_create_notification_is_idempotent(student_user):
    kwargs = {"user_id": student_user.id, "title": "Once", "message": "Only once", "notification_type": "SYSTEM"}
    first = create_notification(**kwargs)
    second = create_notification(**kwargs)
    assert first["id"] == second["id"]
    assert Notification.objects.count() == 1


@pytest.mark.django_db
def test_retry_undelivered_re_drives_stale_notifications(student_user):
    from django.utils import timezone

    stale = Notification.objects.create(
        user=student_user,
        title="Stale",
        message="never sent",
        is_sent=False,
        created_at=timezone.now(),
    )
    retried = retry_undelivered(minutes=0)
    stale.refresh_from_db()
    assert retried == 1
    assert stale.is_sent is True
    assert stale.sent_at is not None
