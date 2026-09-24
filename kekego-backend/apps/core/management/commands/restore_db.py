"""``restore_db`` - restore the database from a ``backup_db`` artifact.

PostgreSQL files (``pg_dump --format=custom``) are restored with
``pg_restore`` (with ``--clean --if-exists``). SQLite backups are copied back
with the ``sqlite3`` ``backup()`` API so the target file is never half-written
on error.

Destructive by nature: prints a confirmation prompt unless ``--yes`` is given
or the target is a temporary file (tests use this path).
"""

import sqlite3
import subprocess
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Restore the database from a backup created by backup_db."

    def add_arguments(self, parser):
        parser.add_argument("--input", "-i", dest="input", required=True, help="Backup file to restore.")
        parser.add_argument(
            "--target",
            dest="target",
            default=None,
            help="SQLite target file (default: configured DB file). Foreign to PostgreSQL restores.",
        )
        parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt.")

    def handle(self, *args, **options):
        source = Path(options["input"])
        if not source.exists():
            raise CommandError(f"Backup file does not exist: {source}")
        yes = options["yes"]

        vendor = connection.vendor
        if vendor == "postgresql":
            if not yes:
                raise CommandError("Refusing destructive PostgreSQL restore without --yes.")
            self._restore_postgres(source)
        elif vendor == "sqlite":
            target = Path(options["target"]) if options["target"] else Path(connection.settings_dict["NAME"])
            if target.exists() and not yes and ":memory:" not in str(target):
                raise CommandError(f"Refusing to overwrite {target} without --yes.")
            self._restore_sqlite(source, target)
        else:
            raise CommandError(f"Restore is not implemented for database vendor {vendor!r}.")

        self.stdout.write(f"Restore completed from {source}.")

    def _restore_postgres(self, source: Path) -> None:
        database = connection.settings_dict
        command = [
            "pg_restore",
            "--exit-on-error",
            "--clean",
            "--if-exists",
            "--no-owner",
            "--dbname",
            database.get("NAME"),
        ]
        if database.get("HOST"):
            command += ["--host", database.get("HOST")]
        if database.get("PORT"):
            command += ["--port", str(database.get("PORT"))]
        if database.get("USER"):
            command += ["--username", database.get("USER")]
        command.append(str(source))
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=False)
        except FileNotFoundError as exc:
            raise CommandError("pg_restore was not found on PATH. Install PostgreSQL client tools.") from exc
        if result.returncode != 0:
            raise CommandError(f"pg_restore failed: {result.stderr or result.stdout}")

    def _restore_sqlite(self, source: Path, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        source_conn = sqlite3.connect(str(source))
        target_conn = sqlite3.connect(str(target))
        try:
            source_conn.backup(target_conn)
        finally:
            target_conn.close()
            source_conn.close()
