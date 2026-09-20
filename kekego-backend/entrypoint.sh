#!/bin/sh
# Docker container entrypoint: wait for PostgreSQL, run migrations, then
# hand off to the container CMD.
set -e

echo "Waiting for PostgreSQL to become available..."
until python -c "
import os, sys, time
import psycopg
try:
    psycopg.connect(
        host=os.environ.get('DATABASE_HOST', 'db'),
        port=os.environ.get('DATABASE_PORT', '5432'),
        user=os.environ.get('DATABASE_USER', 'campus_keke'),
        password=os.environ.get('DATABASE_PASSWORD', ''),
        dbname=os.environ.get('DATABASE_NAME', 'campus_keke'),
    ).close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
    echo "  still waiting for PostgreSQL..."
    sleep 2
done
echo "PostgreSQL is up."

echo "Applying database migrations..."
python manage.py migrate --noinput

exec "$@"