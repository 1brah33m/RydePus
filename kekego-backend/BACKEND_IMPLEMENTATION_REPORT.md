# TransitX Backend Implementation Report

**Project:** TransitX / KekeGo Backend  
**Framework:** Django 5.x and Django REST Framework  
**Report date:** 2026-09-20

## 1. Executive Summary

The TransitX backend is implemented as a modular Django monolith for a student transportation platform. It provides authentication, role-based access, driver availability, ride groups, trip lifecycle management, payment records and buyout payment intents, and notifications.

The backend is currently suitable as a tested MVP foundation. It is not yet production-complete because route-specific driver matching, trip ratings, an in-app wallet, buyout refunds, frontend contract alignment, operational hardening, and production deployment validation remain outstanding.

The latest relevant backend validation completed successfully with **46 tests passing**.

## 2. Architecture

The project is organized into domain-focused Django applications:

- `apps.users`: custom email-based user accounts, roles, authentication, serializers, tokens, and permissions.
- `apps.drivers`: driver profiles and availability state.
- `apps.groups`: student ride groups and memberships.
- `apps.trips`: trip creation, driver discovery, assignment, status transitions, and student cancellation.
- `apps.payments`: manual trip payments (cash or direct bank transfer) with driver confirmation, and group buyout payment intents.
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
- Payout details: `bank_name`, `account_number`, `account_name`, all required together, with the account number normalised to at least 10 digits
- A read-only `has_payout_details` flag, also used to decide whether a student sees the direct-transfer option
- Online-driver trip discovery
- Atomic trip acceptance
- Driver state changes to `BUSY` after accepting a trip

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/drivers/me/` | Driver | Retrieve the driver profile |
| `PATCH` | `/api/v1/drivers/availability/` | Driver | Change availability |
| `PATCH` | `/api/v1/drivers/payout/` | Driver | Save the bank account for fare transfers |
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
| `POST` | `/api/v1/groups/{id}/buyout/` | Student member | Pay for all remaining seats so the group can depart |

Group behavior:

- Every group is a 4-seat ride: capacity is fixed at 4 and any other value is rejected.
- The creator is automatically added as the first member.
- Occupied seats are `members + bought seats` (capped at 4); a bought seat counts as a passenger.
- A group is dispatchable (and `FULL`) only when all 4 seats are accounted for, either by members or by a buyout.
- A buyout must cover *all* remaining seats, since a partial buyout would leave the group under 4/4.
- A member cannot join a group whose 4 seats are already accounted for.
- A member cannot leave after a trip is accepted, started, or completed.
- A creator cannot cancel after a trip is committed.
- The last member leaving removes the empty group.
- Cancelling a group cancels pending related trips before deleting the group.
- When a member leaves and the group drops below 4/4, its still-`PENDING` trip is cancelled so it never reaches a driver.

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
- Conditional dispatch: a trip is only created once the group is full (4/4 members, or members plus bought seats)
- One active trip per group, so simultaneous "fourth joiners" cannot double-dispatch
- Student-owned trip listing
- Driver pending-trip discovery, restricted to trips whose group is `FULL`
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

Trip ratings are not yet implemented. There is no rating model, serializer, or rating endpoint.

## 7. Payments Module

Implemented payment types:

- `TRIP`
- `GROUP_BUYOUT`

Implemented payment methods:

- `CASH`
- `BANK_TRANSFER`

Implemented payment statuses:

- `PENDING`
- `SUCCESSFUL`
- `FAILED`

Implemented features:

- Manual fare payment records for trips with an assigned driver
- Payment by cash or direct bank transfer, with no payment provider involved
- Group-member payment ownership validation (any member may pay their own seat)
- Assigned-driver requirement and `ACCEPTED`/`IN_PROGRESS`/`COMPLETED` payable-status check
- Amount validation against the trip fare
- Bank-transfer payments blocked until the assigned driver has saved payout details
- Duplicate active-payment protection per trip and payer
- Driver confirmation (sets `SUCCESSFUL` and records `confirmed_by`/`confirmed_at`) and rejection (sets `FAILED`) for reported non-payment
- Row locking plus idempotent confirmation so a double tap or a confirm/reject race cannot settle a payment twice
- Driver-scoped collectable payment listing, with awaiting-confirmation payments first
- Driver payout details on `DriverProfile` (`bank_name`, `account_number`, `account_name`) with a `has_payout_details` flag
- Trip responses expose `driver_bank` only for assigned trips whose driver has complete payout details
- Group-linked buyout payment intents
- Seat and capacity validation for buyout intents
- Duplicate active buyout-intent protection
- Database constraint requiring each payment to target exactly one trip or one group

Endpoints:

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/payments/` | Student | List the student's payments |
| `POST` | `/api/v1/payments/` | Student | Record a manual cash or bank-transfer payment as `PENDING` |
| `GET` | `/api/v1/payments/collectable/` | Driver | List fares owed to the signed-in driver |
| `POST` | `/api/v1/payments/{id}/confirm/` | Assigned driver | Confirm cash/transfer receipt |
| `POST` | `/api/v1/payments/{id}/reject/` | Assigned driver | Report that the money never arrived |
| `PATCH` | `/api/v1/drivers/payout/` | Driver | Save the bank account students transfer fares to |
| `POST` | `/api/v1/groups/{id}/buyout/` | Student member | Create a pending group-buyout payment intent |

Rides are settled by hand, so no payment provider is integrated and no provider secrets are stored. The student-facing in-app wallet is a frontend placeholder: no wallet or balance model exists in the backend, and money never sits on the platform.

Group buyout requests remain `PENDING` and are not tied to a provider confirmation; bought seats are counted immediately for dispatchability.

Payment references, webhooks, provider callbacks, refunds, and idempotency keys remain unimplemented, and are not required for the cash/transfer flow.

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

The relevant backend suite currently contains **46 passing tests** covering:

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
- Manual cash/bank-transfer payment validation
- Payment amount validation
- Duplicate active payment protection
- Driver payout details and manual payment confirmation/rejection
- Trip `driver_bank` exposure rules
- Notification listing and read behavior

Latest full-suite command:

```powershell
$env:DJANGO_SECRET_KEY = "dev-secret-key-for-testing"
$env:DJANGO_DEBUG = "True"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,testserver"
py -m pytest tests/test_api.py tests/test_auth.py tests/test_permissions.py tests/test_groups.py tests/test_trips.py tests/test_payments.py tests/test_notifications.py -q
```

Latest result:

```text
46 passed
```

## 12. Frontend Integration Status

The frontend currently uses a local mock backend and frontend-specific domain types. It is not yet connected to the Django API.

The main data-shape differences are:

- Frontend roles use lowercase values; backend roles use uppercase values.
- Frontend users use `fullName` and `phone`; backend users use first/last names and `phone_number`.
- Frontend locations are `{ id, name }` objects; backend locations are strings.
- Frontend groups include members, seat counts, status, and group codes; backend groups expose capacity, `member_count`, `bought_seats`, and `seats_filled`.
- Frontend trips use a different lifecycle vocabulary and expect driver details and ratings.
- Frontend payments expect provider references, methods, seats, and success/failure results; backend exposes manual cash/bank-transfer records with `payer_name`, `awaiting_confirmation`, and `confirmed_at` instead of provider references.

An endpoint mapping is documented in [API_FRONTEND_MAPPING.md](API_FRONTEND_MAPPING.md). The frontend integration layer should be created only after the remaining backend contracts are finalized.

## 13. Remaining Production Gaps

The following work remains:

### Domain features

- Route-specific driver matching
- Driver request filtering by route and vehicle/availability criteria
- Trip ratings and comments
- In-app wallet/balance, if the product ever moves money through the platform
- Buyout refunds: a buyout fills seats immediately, so a cancelled trip must refund the buyer
- Server-side trip dispatch: trips are currently created by the client when a group becomes full
- Driver notification access and event triggers
- Frontend/backend response-shape alignment

### Reliability and security

- Pagination for groups, trips, payments, and notifications
- Rate limiting for authentication, joins, trip acceptance, and payment operations
- Request idempotency keys
- Audit logging for authentication, trip state changes, group membership, and payments
- Stronger duplicate and concurrency rules across all write workflows
- Consistent error-envelope handling for all serializer validation errors
- Token revocation or blacklist-backed logout

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
| Manual cash/bank-transfer payment and driver confirmation | Implemented and tested |
| Driver payout details | Implemented and tested |
| In-app wallet/balance | Not implemented (frontend placeholder only) |
| Ratings | Not implemented |
| Frontend integration | Not complete |
| Production hardening | Not complete |
| Production deployment readiness | Not complete |

## 15. Recommended Next Order

1. Implement trip ratings and comments.
2. Add route-specific driver matching and driver request filtering.
3. Move full-group dispatch to the backend (so a closed client cannot delay departure) and add buyout refunds.
4. Align frontend and backend data contracts.
5. Add pagination, rate limiting, audit logging, and idempotency.
6. Validate PostgreSQL, Redis, Celery, HTTPS, secrets, monitoring, backups, and deployment rollback.
7. Replace the frontend mock services with the real HTTP integration layer.
