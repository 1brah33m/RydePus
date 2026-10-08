# Campus Keke / Rydepus — Public API Contract (v1)

This document is the **source of truth** for client-developer contracts. Backend
changes that violate these guarantees must be version-bumped, never silently
broken.

- Base URL: `https://<api-host>/`
- Current version: `v1` — everything below lives under `/api/v1/`.
- Format: JSON (`Content-Type: application/json`).
- Auth: `Authorization: Bearer <access-token>` (JWT, simplejwt).
- Timestamps: ISO-8601 / RFC 3339 (Django renders them with timezone offsets).
- Money: decimal strings with 2 decimal places, e.g. `"250.00"` (never floats).

---

## 1. Versioning

- Versions are encoded in the URL path: `/api/v1/...`.
- A new major version (`/api/v2/`) is the only way to make a breaking change.
- Deprecated behavior is documented for at least one release cycle before
  removal. The OpenAPI schema (drf-spectacular) tracks the active version.

## 2. Pagination

**Every list endpoint** returns the same envelope (no bare arrays):

```json
{
  "count": 42,
  "page": 1,
  "page_size": 20,
  "results": [ ... ]
}
```

- `?page=N` — page number (1-based).
- `?page_size=M` — page size; default `20`, **capped at `100`**.
- `count` is the total across all pages; `page_size` reflects the applied
  (possibly capped) size.

## 3. Errors

Every error (4xx/5xx) uses one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "human readable message",
    "request_id": "a1b2c3d4e5f6a7b8"
  },
  "errors": {
    "field_name": ["detail"]
  }
}
```

- `errors` is present **only** for validation failures (DRF field errors).
- `request_id` is also returned in the `X-Request-ID` response header and echoed
  in structured logs, so clients can hand it to support for tracing.
- Internal errors never leak stack traces, secrets, or SQL to clients.

### Error codes

| Code | Meaning | Typical HTTP |
| --- | --- | --- |
| `NOT_AUTHENTICATED` | Missing/invalid credentials | 401 |
| `AUTHENTICATION_FAILED` | Bad login credentials | 401 |
| `TOKEN_INVALID` | Expired/revoked JWT | 401 |
| `PERMISSION_DENIED` | Wrong role / not allowed | 403 |
| `NOT_FOUND` | Resource does not exist | 404 |
| `METHOD_NOT_ALLOWED` | Wrong HTTP verb | 405 |
| `VALIDATION_ERROR` | Field-level validation failed | 400 |
| `INVALID` | Business-rule violation | 400 |
| `INVALID_STATE` | Resource in wrong state for the operation | 400/409 |
| `DUPLICATE` | Already exists (e.g. double rating) | 409 |
| `INVALID_SIGNATURE` | Payment webhook signature check failed | 400 |
| `INVALID_PAYLOAD` | Webhook malformed/missing reference | 400 |
| `PAYMENT_PROVIDER_ERROR` | Provider rejected/unreachable | 502 |
| `THROTTLED` | Rate limit exceeded | 429 |
| `SERVER_ERROR` | Unhandled internal error | 500 |

## 4. Rate limiting

Throttle rates are set server-side via env (`DRF_THROTTLE_ANON`,
`DRF_THROTTLE_USER`). Exceeding a limit returns `429` with the envelope above.

## 5. Idempotency (payments)

`POST /api/v1/payments/` accepts an optional `idempotency_key`:

- Replaying the same key with identical fields returns the **same** payment
  with `200 OK` (not a duplicate).
- Reusing a key with different fields returns `400 INVALID`.

## 6. Payment lifecycle & reconciliation

- Rides are settled by hand (cash or direct transfer), so a student's
  declaration is the source of truth: `POST /api/v1/payments/` creates the
  payment `SUCCESSFUL` with `confirmed_at` set. There is no driver confirmation
  step and no confirm/reject endpoint.
- A driver can still review fares they collected with
  `GET /api/v1/payments/collectable/`, but that list is read-only.
- `PENDING` and `FAILED` remain valid states for provider-backed charges and for
  records written before this flow; migration `payments.0007` settled the
  existing `PENDING` rows so they were not stranded.
- Amounts are always computed and checked server-side:
  - Trip payments must equal `seats * trip.fare` (default `seats = 1`).
  - Buyout amounts are computed from the group's own coordinates; client-supplied
    amounts are ignored entirely. A buyout is one consolidated charge for the
    whole share: the student's own seat plus the empty seats they are filling.
    The own seat is billed only on the student's first buyout in a group, so a
    later top-up charges only the extra seats. `seats` on the payment still
    records the empty seats covered; the amount uses
    `(seats + own_seat_due) * fare_per_seat`.
- Fares come from `apps.core.pricing`, driven by `BASE_FARE`,
  `FARE_RATE_PER_KM`, `MIN_SEAT_FARE` and `FARE_ROUNDING`. Groups expose the
  authoritative `fare_per_seat`, `fare_total`, `remaining_seats` and the
  per-user `own_seat_paid` flag (true once the requesting member's own seat has
  been covered by a buyout).
- A buyout may take any number of a group's empty seats (`1..remaining`).
  Taking all of them makes the group dispatchable; taking fewer leaves those
  seats open for other passengers.
- Group creation (`POST /api/v1/groups/`) accepts an optional `seats` (1..4,
  default 1) and `amount`. When `seats > 1` the server adds the creator and buys
  their `seats - 1` extra seats in the same atomic request, so the response
  already reflects the covered seats (`bought_seats`, `seats_filled`,
  `remaining_seats`, `own_seat_paid`). Clients never need a follow-up partial
  buyout after creating a group. Out-of-range `seats` returns `400`.

### Refunds

- `POST /api/v1/payments/{id}/refund/` (`{ "amount": "50.00", "reason": "..." }`)
  refunds up to the outstanding (unrefunded) balance of a `SUCCESSFUL` payment.
- Outstanding balance = `amount - refunded_amount`; over-refund requests return
  `400 VALIDATION_ERROR`.
- The refund is tracked in the response (`status`, `provider_reference`).

### Webhooks

- `POST /api/v1/payments/webhook/` — no auth (`AllowAny`); authenticity comes
  from the provider signature (`X-Paystack-Signature` for Paystack).
- Success events confirm payment + grant seats; refund events update the refund
  ledger; unknown references return `404`.

## 7. Notifications

- `GET /api/v1/notifications/` — paginated list for the authenticated user.
- `PATCH /api/v1/notifications/{id}/read/` — mark one read.
- Records carry `is_sent` / `sent_at`; a periodic worker task re-drives anything
  left unsent.

## 8. Correlation / observability

- Inbound `X-Request-ID`, when present, is used as the correlation id; otherwise
  the backend generates one.
- The id is stamped on the response (`X-Request-ID`), included in every error
  envelope, and written to structured JSON request logs.

## 9. API documentation

- Swagger UI: `GET /api/docs/`
- ReDoc: `GET /api/redoc/`
- OpenAPI schema: `GET /api/schema/`

Docs are **opt-in** via `DJANGO_ENABLE_API_DOCS` (default: development only),
so schema routes do not exist in a hardened production deployment.

## 10. Health & readiness

- `GET /api/v1/health/` — liveness / DB reachability → `{"status":"ok"}`.
- `GET /api/v1/health/ready/` — readiness: DB + Redis checks. HTTP 200 when
  both answer; 503 otherwise.

## Endpoint catalog (v1)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register/` | public | Register STUDENT/DRIVER |
| `POST` | `/api/v1/auth/login/` | public | JWT pair |
| `POST` | `/api/v1/auth/refresh/` | refresh | Refresh access token |
| `GET/PATCH` | `/api/v1/auth/me/` | Bearer | Current user |
| `POST` | `/api/v1/auth/change-password/` | Bearer | Change password |
| `GET/PATCH` | `/api/v1/drivers/me/` | DRIVER | Driver profile/availability |
| `GET/POST` | `/api/v1/groups/` | STUDENT | List (paginated) / create group |
| `POST` | `/api/v1/groups/{id}/join/` | STUDENT | Join (capacity-protected) |
| `POST` | `/api/v1/groups/{id}/leave/` | STUDENT | Leave |
| `POST` | `/api/v1/groups/{id}/cancel/` | STUDENT | Cancel uncommitted group |
| `POST` | `/api/v1/groups/{id}/buyout/` | STUDENT | Buy empty seats (settles immediately) |
| `GET/POST` | `/api/v1/trips/` | STUDENT | List (paginated) / create trip |
| `GET` | `/api/v1/trips/available/` | verified DRIVER | Discover pending trips |
| `POST` | `/api/v1/trips/{id}/accept/` | verified DRIVER | Accept trip |
| `POST` | `/api/v1/trips/{id}/cancel/` | STUDENT | Cancel pending trip |
| `POST` | `/api/v1/trips/{id}/cancel/driver/` | verified DRIVER | Cancel assigned trip |
| `POST` | `/api/v1/trips/{id}/start/` | verified DRIVER | Start trip |
| `POST` | `/api/v1/trips/{id}/complete/` | verified DRIVER | Complete trip |
| `POST` | `/api/v1/trips/{id}/rating/` | participants | Rate completed trip once |
| `GET/POST` | `/api/v1/payments/` | STUDENT | List (paginated) / create payment (settles) |
| `GET` | `/api/v1/payments/collectable/` | DRIVER | Fares collected (read-only) |
| `POST` | `/api/v1/payments/{id}/refund/` | STUDENT | Refund successful payment |
| `POST` | `/api/v1/payments/webhook/` | provider | Payment/refund webhook |
| `GET` | `/api/v1/notifications/` | Bearer | List notifications |
| `PATCH` | `/api/v1/notifications/{id}/read/` | Bearer | Mark notification read |
| `GET` | `/api/v1/health/` | public | Liveness |
| `GET` | `/api/v1/health/ready/` | public | Readiness |