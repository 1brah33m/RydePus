# Campus Keke — Backend

REST API backend for a campus keke (tricycle) transportation platform for
students and drivers. This is a **foundation / boilerplate**: the core
transportation business logic (grouping, matching, payments, trips) will be
built on top of this structure in later stages.

---

## 1. What the backend does

- Creates student and driver accounts (email + password).
- Issues **JWT** access/refresh tokens (`djangorestframework-simplejwt`).
- Enforces **role-based access** on the server (`STUDENT` / `DRIVER`) — never
  trust the frontend for security.
- Exposes a health check and self-documenting API (Swagger/Redoc/OpenAPI).
- Runs background work through **Celery** (Redis as broker).
- Is production-ready via **Docker Compose** (app + PostgreSQL + Redis +
  Celery worker).

## 2. Technology stack

| Layer       | Technology                                        |
| ----------- | ------------------------------------------------- |
| Language    | Python 3.13                                       |
| Framework   | Django 5.2, Django REST Framework                 |
| Auth        | djangorestframework-simplejwt (Bearer JWT)        |
| Docs        | drf-spectacular (OpenAPI 3 + Swagger/Redoc)       |
| Database    | PostgreSQL (psycopg3)                             |
| Cache/Broker| Redis (Celery broker + result backend)            |
| Async tasks | Celery                                            |
| Config      | django-environ (`.env`)                           |
| Tests       | pytest + pytest-django                            |
| Infra       | Docker, Docker Compose                            |

## 3. Architecture

Modular monolith: one Django application with cleanly separated apps, not
microservices.

```
  Frontend (React PWA - see ../kekego-student)
       |
       |  HTTPS REST JSON (/api/v1/...)
       v
  Django + Django REST Framework  (stateless, JWT auth)
       |
       +-------------+------------------+
       |             |                  |
       v             v                  v
  PostgreSQL    Redis (broker)     Celery workers
  (source of    (caching, temp     (async jobs,
   truth)        data, queues)      notifications later)
```

Scale target: ~3,000 students and ~10 drivers. The app is stateless so it can
be scaled horizontally behind a load balancer (same PostgreSQL, Redis, and
Celery infra):

```
        Load Balancer
        |     |     |
        v     v     v
     Django  Django  Django
        \     |     /
         PostgreSQL + Redis + Celery
```

No Kubernetes / no microservices — by design.

## 4. Folder structure

```
campus-keke-backend/
│
├── config/                      # Django project (settings, wsgi, celery...)
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py              # shared settings (reads .env)
│   │   ├── development.py       # dev: DEBUG on, SQLite fallback, open CORS
│   │   ├── production.py        # prod: DEBUG off, HTTPS locked down
│   │   └── test.py              # pytest: in-memory SQLite, eager Celery
│   │
│   ├── __init__.py              # registers celery app
│   ├── celery.py                # Celery app + task discovery
│   ├── urls.py                  # /api/v1/... + /api/docs/, /api/schema/
│   ├── asgi.py / wsgi.py
│   ├── exceptions.py            # consistent {error:{code,message}} format
│   ├── logging_conf.py          # console + JSON structured logging
│   ├── spectacular.py           # JWT security scheme for the docs
│   └── views.py                 # /api/v1/health/
│
├── apps/
│   ├── users/          # custom User, auth endpoints, role permissions
│   ├── drivers/        # (placeholder) driver profiles / approvals later
│   ├── groups/         # (placeholder) group rides - core future feature
│   ├── trips/          # (placeholder) trip lifecycle
│   ├── payments/       # (placeholder) wallets / payments later
│   └── notifications/  # (placeholder) + sample Celery task
│
├── tests/                      # pytest suite
├── manage.py
├── requirements.txt            # runtime dependencies
├── requirements-dev.txt        # + pytest tooling
├── .env.example                # environment template (copy to .env)
├── .env                        # secret, git-ignored
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh               # waits for DB, runs migrations, starts app
├── pytest.ini
└── README.md
```

## 5. Configure `.env`

Copy the template and fill in real values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django secret. **Never commit a real one.** |
| `DJANGO_DEBUG` | `True` in development, `False` in production. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins (React PWA). |
| `DATABASE_URL` | Optional full Postgres URL (`postgres://user:pass@host:5432/name`). |
| `DATABASE_NAME/USER/PASSWORD/HOST/PORT` | Used when `DATABASE_URL` is empty and `DATABASE_HOST` is set. |
| `REDIS_URL` | Used by Celery broker/result backend. |
| `JWT_ACCESS_TOKEN_MINUTES` / `JWT_REFRESH_TOKEN_DAYS` | Token lifetimes. |

> **Local convenience:** if `DATABASE_URL` is empty **and** `DATABASE_HOST` is
> empty, the development settings automatically fall back to a local SQLite
> file (`db.sqlite3`) so `runserver` works without PostgreSQL. In production a
> database is mandatory and startup fails if none is configured.

## 6. Run locally (without Docker)

```bash
cd campus-keke-backend

# Windows
py -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements-dev.txt

# If you want PostgreSQL locally, set DATABASE_HOST etc. in .env first.
# Otherwise the SQLite fallback kicks in automatically.

python manage.py migrate
python manage.py runserver
```

Open <http://127.0.0.1:8000/api/v1/health/> — you should see `{"status": "ok"}`.

## 7. Run with Docker (PostgreSQL + Redis + worker)

Requires Docker Desktop (or Docker + Compose). No local Python needed.

```bash
cd campus-keke-backend
cp .env.example .env        # fill in real values
docker compose up --build
```

Services:

- `web` — Django + gunicorn on `http://localhost:8000`
- `db` — PostgreSQL 16 on `localhost:5432`
- `redis` — Redis 7 on `localhost:6379`
- `worker` — Celery worker

The entrypoint waits for PostgreSQL, applies migrations, then starts the app.
Everything talks over the internal Compose network. Stop everything with
`docker compose down` (add `-v` to also drop the database volume).

## 8. Run migrations

```bash
python manage.py makemigrations   # create migrations for new model changes
python manage.py migrate          # apply them
python manage.py showmigrations   # list applied/unapplied
```

> Migrations are created/edited by the framework. Do not hand-edit migration
> files unless you know exactly what you are doing.

## 9. Create a superuser (admin dashboard)

```bash
python manage.py createsuperuser
```

Then go to <http://127.0.0.1:8000/admin/> and log in. Superuser accounts can
optionally be given a `STUDENT` or `DRIVER` role, but they are recognised by
their admin flags.

## 10. Run tests

```bash
python -m pytest
```

Tests run against an in-memory SQLite database with Celery in eager mode — no
external services are required. The suite covers registration, login, refresh,
`/me/`, role permissions (student-only vs driver-only), unauthorized requests,
invalid login, the health check, and the error format.

## 11. Start Celery

```bash
celery -A config worker --loglevel=info
```

Verify a task end-to-end (needs Redis running):

```bash
python manage.py shell -c "from apps.notifications.tasks import sample_test_task; print(sample_test_task.delay().get())"
```

Expected output: `processed: hello from campus keke`.

## 12. API documentation

- Swagger UI: <http://127.0.0.1:8000/api/docs/>
- ReDoc: <http://127.0.0.1:8000/api/redoc/>
- Raw OpenAPI schema: <http://127.0.0.1:8000/api/schema/>

Authentication (Bearer JWT) is wired into the schema, and the Swagger UI has
**Authorize** enabled (`persistAuthorization`).

## 13. How authentication works

1. `POST /api/v1/auth/register/` — create a `STUDENT` or `DRIVER` account.
2. `POST /api/v1/auth/login/` — returns `{ "user": {...}, "access": "...", "refresh": "..." }`.
3. Send the access token on every request:

```
Authorization: Bearer <access-token>
```

4. Access tokens expire after `JWT_ACCESS_TOKEN_MINUTES` (default 60). Use
   `POST /api/v1/auth/refresh/` with the refresh token to get a new pair.
5. `GET /api/v1/auth/me/` returns the current user.

The email is the login identifier. Passwords are hashed with Django's default
hashing. No credentials or tokens are ever logged.

## 14. How roles work

- `STUDENT` — ride feature area (groups, trips). e.g. `GET /api/v1/groups/ping/`.
- `DRIVER` — driver area. e.g. `GET /api/v1/drivers/me/`.

Role is chosen at **registration only** and is **read-only afterwards** — a
user cannot change their role through a profile endpoint. Access is enforced
by reusable DRF permission classes in `apps/users/permissions.py`
(`IsStudent`, `IsDriver`) that return HTTP 403 for the wrong role. The
frontend only *routes* users; the backend enforces.

> Driver **verification/approval** is not implemented yet — it will be layered
> on top of DRIVER registrations in a later stage.

## 15. Future architecture: Groups → Trips → Drivers

This is the roadmap the foundation is prepared for. **Nothing here is
implemented yet.**

```
Student creates/joins a group     1/4  2/4  3/4  4/4
        (increment member count inside a DB transaction)
                    |
        group reaches 4/4  OR  a student pays for ALL 4 seats
                    |
                    v
              Group is FULL  ───>  Trip is created
                    |
                    v
          Driver matching (strict: same pickup + same destination)
                    |
                    v
            Driver accepts the trip
                    |
                    v
              Trip begins  ───>  Trip completes
```

### Concurrency safety (design decision)

Joining a group must never produce `5/4`. The future implementation will use:

- `django.db.transaction.atomic()` blocks,
- `select_for_update()` row locks on the group,
- a database `CHECK` constraint / partial unique constraint on capacity,
- atomic `F()` expressions where appropriate.

PostgreSQL is the source of truth; Redis/`local memory` is never used for
permanent business state, so multiple Django instances can safely share the
same database.

## API endpoints (current)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health/` | none | Liveness/DB check `{"status":"ok"}` |
| `POST` | `/api/v1/auth/register/` | none | Create STUDENT/DRIVER account |
| `POST` | `/api/v1/auth/login/` | none | Email+password → JWT pair |
| `POST` | `/api/v1/auth/refresh/` | refresh token | Refresh access token |
| `GET` | `/api/v1/auth/me/` | Bearer | Current user |
| `GET` | `/api/v1/drivers/me/` | Bearer + DRIVER | Driver-only exemplar |
| `GET` | `/api/v1/groups/ping/` | Bearer + STUDENT | Student-only exemplar |
| `GET` | `/api/docs/`, `/api/redoc/`, `/api/schema/` | none | API docs |
| `GET/POST` | `/admin/` | Django admin | Staff dashboard |

## Error format

All errors (4xx/5xx) use one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message"
  }
}
```

Internal errors never leak stack traces or secrets to clients; they are
logged server-side instead. Codes include `AUTHENTICATION_FAILED`,
`NOT_AUTHENTICATED`, `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION_ERROR`,
`METHOD_NOT_ALLOWED`, `THROTTLED`, and `SERVER_ERROR`.