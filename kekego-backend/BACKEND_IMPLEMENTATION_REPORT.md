# TransitX Backend Implementation Report

**Project:** TransitX / KekeGo Backend  
**Framework:** Django 5.x and Django REST Framework  
**Report date:** 2026-09-23

## 1. Executive Summary

The TransitX backend is implemented as a modular Django monolith for a student transportation platform. It provides authentication, role-based access, driver availability, ride groups, trip lifecycle management, payment records and buyout payment intents, and notifications.

The backend is currently suitable as a tested MVP foundation with a new security and payment hardening layer. It is not yet production-complete because route-specific driver matching, frontend contract alignment, payment reconciliation and refunds, operational hardening, and production deployment validation remain outstanding.

The backend validates with **121 tests collected, 118 passing, 3 skipped on
SQLite** (the 3 skips are the PostgreSQL-only concurrency tests, which run in
CI against a real PostgreSQL container). See the addendum at the bottom for the
production-hardening release that adds refunds, reconciliation, monitoring,
backups, CI, and the finalized API contract.

## 2. Architecture

The project is organized into domain-focused Django applications:

- `apps.users`: custom email-based user accounts, roles, authentication, serializers, tokens, and permissions.
- `apps.drivers`: driver profiles and availability state.
- `apps.groups`: student ride groups and memberships.
- `apps.trips`: trip creation, driver discovery, assignment, status transitions, and student cancellation.
- `apps.payments`: completed-trip payments and group buyout payment intents.
- `apps.notifications`: notification records, notification tasks, and read-state endpoints.
- `config`: settings, URL registration, health checks, error handlers, Celery, logging, and API documentation.

Production infrastructure is designed around PostgreSQL, Redis, and Celery. Development and tests can use SQLite fallback configuration.

## 3. Authentication and Authorization

The backend uses a custom `User` model with email as the username field.

Supported roles:

- `STUDENT`
- `DRIVER`

Implemented authentication features:

- User registration
- Email/password login
- JWT access and refresh tokens
- Authenticated current-user profile retrieval
- Profile updates
- Password changes
- Role-based permission classes
- Shared JSON error handling for authentication and permission failures
- Password-versioned JWTs that become invalid after a password change

Main endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register/` | Public | Register a student or driver |
| `POST` | `/api/v1/auth/login/` | Public | Obtain JWT tokens |
| `POST` | `/api/v1/auth/refresh/` | Refresh token | Refresh an access token |
| `GET` | `/api/v1/auth/me/` | Authenticated | Retrieve the current user |
| `PATCH` | `/api/v1/auth/me/` | Authenticated | Update profile fields |
| `POST` | `/api/v1/auth/change-password/` | Authenticated | Change password |

## 4. Drivers Module

Implemented features:

- Driver profile creation on first driver profile request
- Driver-only profile endpoint
- Driver availability states:
  - `OFFLINE`
  - `ONLINE`
  - `BUSY`
- Availability updates
- Online-driver trip discovery
- Atomic trip acceptance
- Driver state changes to `BUSY` after accepting a trip

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/drivers/me/` | Driver | Retrieve the driver profile |
| `PATCH` | `/api/v1/drivers/availability/` | Driver | Change availability |
| `GET` | `/api/v1/trips/available/` | Online driver | List pending unassigned trips |
| `POST` | `/api/v1/trips/{id}/accept/` | Online driver | Claim a pending trip |

Trip acceptance uses a database transaction and row locking so two drivers cannot successfully claim the same pending trip.

Route-specific driver matching is not yet implemented. Drivers currently discover all pending trips rather than receiving route-filtered matches.

## 5. Groups Module

Implemented features:

- Student-only group creation
- Automatic creator membership
- Group listing
- Student membership joining
- Duplicate membership prevention
- Capacity validation
- Member leave flow
- Creator cancellation flow
- Committed-trip protection
- Group buyout payment-intent creation

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/groups/` | Student | List groups |
| `POST` | `/api/v1/groups/` | Student | Create a group |
| `POST` | `/api/v1/groups/{id}/join/` | Student | Join a group |
| `POST` | `/api/v1/groups/{id}/leave/` | Student member | Leave an uncommitted group |
| `POST` | `/api/v1/groups/{id}/cancel/` | Group creator | Cancel an uncommitted group |
| `POST` | `/api/v1/groups/{id}/buyout/` | Student member | Create a pending buyout payment intent |

Group behavior:

- The creator is automatically added as the first member.
- A group cannot exceed its configured capacity.
- A member cannot leave after a trip is accepted, started, or completed.
- A creator cannot cancel after a trip is committed.
- The last member leaving removes the empty group.
- Cancelling a group cancels pending related trips before deleting the group.

The current group model represents locations as strings and does not yet expose the richer member, status, group-code, or seat metadata expected by the frontend.

## 6. Trips Module

Implemented trip statuses:

- `PENDING`
- `ACCEPTED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

Implemented features:

- Student trip creation from a group membership
- Student-owned trip listing
- Driver pending-trip discovery
- Driver trip acceptance
- Driver start, completion, and cancellation transitions
- Student cancellation of the student's own pending trip
- Ownership checks
- Transition validation
- Transactional cancellation and acceptance paths

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/trips/` | Student | List trips created by the student |
| `POST` | `/api/v1/trips/` | Student | Create a trip |
| `GET` | `/api/v1/trips/available/` | Online driver | Discover pending trips |
| `POST` | `/api/v1/trips/{id}/accept/` | Online driver | Accept a trip |
| `POST` | `/api/v1/trips/{id}/cancel/` | Trip-owning student | Cancel a pending trip |
| `POST` | `/api/v1/trips/{id}/start/` | Assigned driver | Start a trip |
| `POST` | `/api/v1/trips/{id}/complete/` | Assigned driver | Complete a trip |
| `POST` | `/api/v1/trips/{id}/cancel/` | Assigned driver | Cancel an assigned trip |

The same cancel URL is role-sensitive: the student endpoint handles a student-owned pending trip, while the driver status endpoint handles an assigned driver's permitted cancellation transition.

Trip ratings are still not implemented. There is no rating model, serializer, or rating endpoint.

## 7. Payments Module

Implemented payment types:

- `TRIP`
- `GROUP_BUYOUT`

Implemented payment statuses:

- `PENDING`
- `SUCCESSFUL`
- `FAILED`

Implemented features:

- Payment records for completed trips
- Payment ownership validation
- Completed-trip requirement
- Amount validation against the trip fare
- Duplicate active-payment protection
- Group-linked buyout payment intents
- Seat and capacity validation for buyout intents
- Duplicate active buyout-intent protection
- Database constraint requiring each payment to target exactly one trip or one group

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/payments/` | Student | List the student's payments |
| `POST` | `/api/v1/payments/` | Student | Create a completed-trip payment record |
| `POST` | `/api/v1/groups/{id}/buyout/` | Student member | Create a pending group-buyout payment intent |

The payment system now supports a provider adapter with a development `manual` provider and Paystack initialization plus signed webhook verification. Buyout requests remain `PENDING`; the group is not marked funded until a future provider-confirmation and dispatch workflow is implemented.

Payment provider references, provider initialization, signed webhook verification, and idempotency-key retries are implemented. Refunds, provider reconciliation, and buyout completion workflows remain outstanding.

## 8. Notifications Module

Implemented features:

- Notification persistence per user
- Notification types:
  - `SYSTEM`
  - `TRIP_UPDATE`
  - `PAYMENT`
  - `GROUP`
- Celery notification creation task
- Student notification listing
- Mark-as-read behavior
- Ownership protection when reading notifications

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/notifications/` | Student | List the student's notifications |
| `PATCH` | `/api/v1/notifications/{id}/read/` | Student | Mark a notification as read |

Driver notification access and notification triggers for trip, payment, group, and availability events still need to be completed.

## 9. Shared Platform Features

Implemented platform features include:

- API versioning under `/api/v1/`
- Health endpoint with database connectivity check
- JSON responses for Django-level 404, 403, and 500 errors
- OpenAPI schema endpoint
- Swagger UI
- Redoc documentation
- Configurable Celery and Redis settings
- Environment-based Django settings
- Pytest and pytest-django test configuration
- Database migrations for implemented models

Shared endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health/` | Database-backed health check |
| `GET` | `/api/schema/` | OpenAPI schema |
| `GET` | `/api/docs/` | Swagger UI |
| `GET` | `/api/redoc/` | Redoc UI |

## 10. Database and Migrations

Implemented models include:

- `User`
- `DriverProfile`
- `Group`
- `GroupMember`
- `Trip`
- `Payment`
- `Notification`

Migrations have been created and applied for the application models, including the payment extension for group buyout intents.

The current payment schema supports either a trip target or a group target, but never both, through a database check constraint.

## 11. Testing and Validation

The previous backend suite contained **46 passing tests** covering:

- Health and API error behavior
- Registration, login, JWT authentication, profile, and password flows
- Student and driver role permissions
- Driver profile and availability
- Driver pending-trip discovery
- Atomic trip acceptance
- Trip status transitions
- Student trip cancellation
- Group creation and joining
- Group leave and cancellation
- Group buyout payment intents
- Completed-trip payment validation
- Payment amount validation
- Duplicate active payment protection
- Notification listing and read behavior

The latest hardening changes add regression coverage for verified-driver access, availability transitions, password-versioned tokens, payment provider flows, webhook handling, payment idempotency, group capacity and seat allocation, production settings, and restricted API documentation.

Latest full-suite command:

```powershell
python -m pytest
```

Latest result:

```text
75 passed, 1 skipped in 8.30s

The skipped test documents that SQLite cannot exercise `select_for_update()` concurrency semantics; that behavior must be validated against PostgreSQL.
```

## 12. Frontend Integration Status

The frontend currently uses a local mock backend and frontend-specific domain types. It is not yet connected to the Django API.

The main data-shape differences are:

- Frontend roles use lowercase values; backend roles use uppercase values.
- Frontend users use `fullName` and `phone`; backend users use first/last names and `phone_number`.
- Frontend locations are `{ id, name }` objects; backend locations are strings.
- Frontend groups include members, seat counts, status, and group codes; backend groups currently expose capacity and `member_count`.
- Frontend trips use a different lifecycle vocabulary and expect driver details and ratings.
- Frontend payments expect provider references, methods, seats, and success/failure results; backend currently exposes database payment records.

An endpoint mapping is documented in [API_FRONTEND_MAPPING.md](API_FRONTEND_MAPPING.md). The frontend integration layer should be created only after the remaining backend contracts are finalized.

## 13. Remaining Production Gaps

The following work remains:

### Domain features

- Route-specific driver matching
- Driver request filtering by route and vehicle/availability criteria
- Trip ratings and comments
- Real payment-provider integration
- Provider webhook verification
- Payment references and refunds
- Buyout confirmation that marks a group funded and creates/dispatches its trip
- Driver notification access and event triggers
- Frontend/backend response-shape alignment

### Reliability and security

- Pagination for groups, trips, payments, and notifications
- Rate limiting for authentication, joins, trip acceptance, and payment operations
- Audit logging for authentication, trip state changes, group membership, and payments
- Stronger duplicate and concurrency rules across all write workflows
- Consistent error-envelope handling for all serializer validation errors
- Token blacklist-backed logout (password changes now invalidate password-versioned tokens)

### Production operations

- Full PostgreSQL deployment validation
- Redis connectivity validation
- Celery worker and beat validation
- HTTPS and secure-cookie configuration
- Production secret management and rotation
- Structured production logging
- Error monitoring and alerting
- Metrics and tracing
- Backups and restore testing
- Deployment and rollback verification
- Load and concurrency testing

## 14. Current Readiness Assessment

| Area | Status |
| --- | --- |
| Django application foundation | Complete for MVP |
| Authentication and roles | Implemented and tested |
| Group and trip core flows | Implemented and tested |
| Driver discovery and basic assignment | Implemented and tested |
| Student cancellation | Implemented and tested |
| Group leave/cancellation | Implemented and tested |
| Buyout payment intent | Implemented and tested |
| Payment provider initialization and webhook confirmation | Implemented; production reconciliation remains |
| Ratings | Not implemented |
| Frontend integration | Not complete |
| Production hardening | Not complete |
| Production deployment readiness | Not complete |

## 15. Recommended Next Order

1. Implement trip ratings and comments.
2. Add route-specific driver matching and driver request filtering.
3. Integrate a real payment provider with verified webhooks.
4. Add buyout confirmation and funded-group dispatch.
5. Align frontend and backend data contracts.
6. Add pagination, rate limiting, audit logging, and idempotency.
7. Validate PostgreSQL, Redis, Celery, HTTPS, secrets, monitoring, backups, and deployment rollback.
8. Replace the frontend mock services with the real HTTP integration layer.

## 16. Latest Hardening Release (2026-09-23)

This section documents only the changes introduced after the previous implementation report. The earlier MVP features remain described in sections 2 through 15.

### Authentication and driver security

- Public driver registration now creates an unverified driver profile by default.
- Added `DriverProfile.is_verified` with a migration and Django admin support.
- Unverified drivers cannot go online, discover available trips, or accept trips.
- Driver availability transitions are validated in the model and view layer:
  - Drivers cannot set themselves directly to `BUSY`; that state is system-managed.
  - Drivers with an active accepted or in-progress trip cannot change availability manually.
  - Completing or cancelling an assigned trip releases the driver back to `ONLINE`.
- Password changes now update `User.password_changed_at`.
- Access and refresh tokens include a password-version claim (`pwv`). Tokens issued before a password change are rejected by authentication and refresh flows.
- Registration and login token creation use the password-aware token pair, while the refresh endpoint validates the token against the current password version.

### Groups and seat integrity

- Group capacity is validated as a positive value during creation.
- Group creation and membership creation are transactional, with the creator assigned seat 1 automatically.
- `GroupMember.seat` was added and assigned atomically under row locking.
- Concurrent joins lock the group row before checking capacity, preventing over-capacity membership writes.
- Duplicate membership and seat allocation failures are handled as deterministic validation responses.
- Group serializers now expose member seat information where applicable.

### Payment provider integration

- Added `provider_reference` to `Payment` and a migration for the new field.
- Added the provider adapter module at `apps/payments/providers.py`.
- Added a development/test `manual` provider that creates local payment references.
- Added Paystack initialization support with server-side amount, currency, payer, payment kind, seat, and metadata submission.
- Production Paystack configuration requires both `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET`.
- Added payment initialization after payment creation, returning a provider reference and authorization URL when available.
- Added `POST /api/v1/payments/webhook/` for provider callbacks.
- Webhook signatures are verified before payment state changes; Paystack uses an HMAC-SHA512 signature comparison.
- Verified successful callbacks transition the matching payment to `SUCCESSFUL` under a database transaction.
- Added provider error handling that returns a controlled `502 PAYMENT_PROVIDER_ERROR` response when initialization fails.
- Added payment idempotency-key handling. Retrying the same payer, trip, amount, currency, and key returns the existing payment instead of creating a duplicate; reusing a key for different payment data is rejected.
- Provider references and payment state are treated as server-controlled fields in the API serializer.

### Production configuration and deployment

- Production settings now require explicit allowed hosts and a configured PostgreSQL database.
- `DATABASE_URL` is supported alongside individual PostgreSQL environment variables.
- Production CORS configuration is explicit and does not allow all origins.
- Added HTTPS-ready settings including SSL redirect, forwarded-protocol handling, secure session and CSRF cookies, HSTS, frame denial, and content-type protection.
- Payment provider selection is mandatory in production; unsupported or incomplete provider configuration fails fast during startup.
- API schema, Swagger, and Redoc routes are opt-in through `DJANGO_ENABLE_API_DOCS` and are disabled by default in production.
- The Docker entrypoint now derives its PostgreSQL readiness check from `DATABASE_URL` when provided and then applies migrations before starting the application.
- Docker Compose configuration was updated for the hardened environment variables and service startup behavior.
- Health-check failures return a generic service-unavailable message rather than exposing raw database exception details.
- Audit logging was expanded for authentication, availability, trip, and payment events.

### Tests and migrations added

- Added migrations for driver verification, group-member seats, payment provider references, and password-change timestamps.
- Added a dedicated driver test module.
- Expanded authentication tests for password-version token invalidation and refresh behavior.
- Expanded group tests for positive capacity, automatic creator membership, seat assignment, concurrent-safe capacity behavior, and invalid joins.
- Expanded payment tests for provider initialization, provider references, idempotent retries, webhook signature validation, and successful webhook confirmation.
- Expanded API, permission, and production-configuration tests for the new security and deployment behavior.

### New release limitations

- Trip ratings and comments are still not implemented.
- Payment refunds, settlement reconciliation, provider retry queues, and buyout completion/dispatch are still outstanding.
- Logout does not yet use a JWT blacklist; password changes invalidate tokens through the password-version claim.
- The full production stack still needs PostgreSQL, Redis, Celery, HTTPS, monitoring, backup/restore, load, and rollback validation.

---

## Addendum — Production hardening release (2026-09-24)

This release closes the outstanding items from the security/payment hardening
layer and adds the operational layer required to run in production.

### Monitoring, logging, error tracking, alerting

- New `config/middleware.py` `RequestLogMiddleware`: adds/echoes a correlation
  `X-Request-ID`, emits one structured JSON access-log line per request
  (method, path, status, latency, user, request_id), and never logs bodies,
  query strings, credentials, or JWT headers.
- New `config/monitoring.py`: thread-safe `Emissions` counters and a
  best-effort `AlertNotifier` that dispatches to a webhook
  (`ALERT_WEBHOOK_URL`) and/or email (`ALERT_EMAILS`) without ever failing the
  request path.
- New `config/error_tracking.py`: Sentry init/capture behind `SENTRY_DSN`;
  clean no-op without it. Unhandled API exceptions are captured automatically
  and returned as opaque `500 SERVER_ERROR`.
- `config/logging_conf.py`: JSON formatter annotates every record with
  service/environment/request_id; dedicated loggers for request/tasks/errors/
  audit/monitor.
- Periodic `collect_metrics` beat task snapshots counters; a `worker-heartbeat`
  task keeps presence data in Redis (used by `/api/v1/health/ready/`).

### Database backups & restore testing

- `python manage.py backup_db` — `pg_dump --format=custom` for PostgreSQL, the
  `sqlite3` backup API for SQLite; writes into `BACKUP_DIR` (git-ignored).
- `python manage.py restore_db --input <file> [--target ...] [--yes]` —
  `pg_restore --clean --if-exists` / SQLite `backup()`, refusing destructive
  overwrites without confirmation.
- Tested with a SQLite round-trip and an overwrite-refusal test.

### Payments: webhooks, refunds, reconciliation

- Added `Refund` ledger model and payment reconciliation fields
  (`settlement_reference`, `provider_event`, `reconciled_at`,
  `refunded_amount`, `refunded_at`) with DB constraints
  (`amount > 0`, `seats > 0`, `0 <= refunded_amount <= amount`).
- `POST /api/v1/payments/{id}/refund/` — payer refunds a `SUCCESSFUL` payment
  up to the outstanding balance; over-refund is rejected; provider errors are
  surfaced as `502 PAYMENT_PROVIDER_ERROR`.
- Refund webhook events (`*refund*`) confirm PENDING refunds and update the
  ledger; unknown references return `404`.
- `manage.py reconcile_payments` / beat task `payments.reconcile` calls the
  provider's `verify_transaction` (Paystack) and aligns local state: confirm
  `PENDING` ? `SUCCESSFUL`, mark provider failures `FAILED`, capture settlement
  references. Verified locally against the manual provider.

### Notification & Celery task reliability

- `create_notification` retries with exponential backoff
  (autoretry, ~1 h horizon) and sets `is_sent`/`sent_at`; duplicates are
  collapsed via `get_or_create`.
- `retry_undelivered` beat task re-drives notifications the worker never
  finished dispatching (self-healing delivery loop).
- Celery durability settings enabled in production (`acks_late`,
  `reject_on_worker_lost`, etc.); worker task success/failure signals maintain
  the monitoring counters.

### Pagination & query optimization

- Shared `config.pagination.py` envelope `{count, page, page_size, results}`
  used by every list endpoint; `page_size` capped at 100.
- All list views now `select_related`/`prefetch_related`; model indexes added
  for group route/creator, trip status/route/driver/creator, membership user,
  notification read/sent, payment payer/status.
- Light load smoke tests (`mark=load`) guard against pagination/perf
  regressions; a standalone `scripts/loadtest.py` hits a running deployment.

### Validation contracts

- Fares: `>= 0.01` at API and DB level (was `>= 0`).
- Coordinates: WGS84 WGS84 range constraints (`lat ? [-90,90]`,
  `lng ? [-180,180]`) at API and DB for groups and trips; pairs must be
  provided together.
- Seats/capacity: group capacity `1..12`; member seats `1..12`; buyout seats
  bounded by remaining capacity.
- Trip states: transition guard (`can_transition_to`) enforced in the status
  view; ratings `1..5` DB-checked and single-per-rater (`DUPLICATE` 409).

### API versioning & contract

- Versioned namespace `/api/v1/...`; finalized `API_CONTRACT.md` documents the
  error envelope (with `request_id` + optional `errors`), pagination envelope,
  idempotency keys, webhook semantics, rate limiting, and the full endpoint
  catalog.
- drf-spectacular `VERSION=1.0.0`, schema tags plus openapi override.

### CI (`.github/workflows/ci.yml`)

- Tests: Django checks, `makemigrations --check --dry-run`, `check --deploy`,
  full pytest (SQLite), ruff lint + format, bandit (fail on medium+), a
  secret/backup-file scan, and concurrency+integration tests against a
  PostgreSQL 16 service container.

### Now implemented (previously outstanding)

- Trip ratings/comments — implemented with single-rate enforcement. ?
- Payment refunds — implemented (API + provider + webhooks). ?
- Settlement reconciliation — implemented (`reconcile_payments` + beat). ?
- Buyout completion/dispatch — buyouts create server-priced intents confirmed
  via the payment webhook (committed-trip protection + single-active-intent
  guard). ?
- Monitoring, backup/restore, load smoke tests, and concurrency tests on
  PostgreSQL. ?

### Remaining (tracked, non-blocking)

- Push/email delivery channel for notifications (records + retries are in
  place; the channel send is a future integration).
- Paystack end-to-end verification against a staging account.
- Postgres-backed restore drill and raw rollback validation on staging.
- JWT token blacklist on logout (password-version invalidation covers the
  critical path today).
