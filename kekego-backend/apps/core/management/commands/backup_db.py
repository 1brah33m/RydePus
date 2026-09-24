"""``backup_db`` - create a consistent database backup for restoration.

PostgreSQL uses ``pg_dump`` (custom format by default so ``pg_restore`` can
select what to restore). SQLite uses the Python ``sqlite3`` ``backup()`` API so
a hot file copy stays consistent.

Usage::

    python manage.py backup_db                       # -> backups/rydepus-<ts>.dump
    python manage.py backup_db --output /tmp/go.dump

``BACKUP_DIR`` (env) defaults to ``<project>/backups``. The directory is
git-ignored; backups contain customer data and must be stored encrypted at
rest / on an encrypted volume.
"""

import datetime
import sqlite3
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Create a database backup (pg_dump for PostgreSQL, sqlite3 backup for SQLite)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            "-o",
            dest="output",
            default=None,
            help="Output file path (default: BACKUP_DIR/rydepus-<ts>.<ext>).",
        )
        parser.add_argument("--quiet", action="store_true", help="Suppress detail output.")

    def handle(self, *args, **options):
        vendor = connection.vendor
        self._quiet = options["quiet"]
        output = Path(options["output"]) if options["output"] else self._default_path(vendor)
        output.parent.mkdir(parents=True, exist_ok=True)

        if vendor == "postgresql":
            self._backup_postgres(output)
        elif vendor == "sqlite":
            self._backup_sqlite(output)
        else:
            raise CommandError(f"Backup is not implemented for database vendor {vendor!r}.")

        self._out(f"Backup written to {output} ({output.stat().st_size} bytes).")

    def _default_path(self, vendor: str) -> Path:
        backup_dir = Path(getattr(settings, "BACKUP_DIR", settings.BASE_DIR / "backups"))
        ext = "dump" if vendor == "postgresql" else "sqlite"
        timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")
        return backup_dir / f"rydepus-{timestamp}.{ext}"

    def _backup_postgres(self, output: Path) -> None:
        database = connection.settings_dict
        command = [
            "pg_dump",
            "--format=custom",
            "--no-owner",
            "--compress=9",
            "--dbname",
            database.get("NAME"),
        ]
        if database.get("HOST"):
            command += ["--host", database.get("HOST")]
        if database.get("PORT"):
            command += ["--port", str(database.get("PORT"))]
        if database.get("USER"):
            command += ["--username", database.get("USER")]
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=False)
        except FileNotFoundError as exc:
            raise CommandError("pg_dump was not found on PATH. Install PostgreSQL client tools.") from exc
        if result.returncode != 0:
            raise CommandError(f"pg_dump failed: {result.stderr or result.stdout}")
        output.write_bytes(result.stdout.encode("latin-1", errors="replace"))

    def _backup_sqlite(self, output: Path) -> None:
        source = connection.settings_dict["NAME"]
        destination = sqlite3.connect(str(output))
        try:
            source_conn = sqlite3.connect(source)
            try:
                source_conn.backup(destination)
            finally:
                source_conn.close()
        finally:
            destination.close()

    def _out(self, message: str) -> None:
        if not self._quiet:
            self.stdout.write(message)
