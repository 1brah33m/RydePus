# API to Frontend Mapping

This document maps the implemented Django API to the current frontend services. It is the integration boundary for replacing the frontend mock backend.

## Classification

- **Direct**: the existing endpoint can support the frontend method with only a shared HTTP client.
- **Adapter**: the endpoint exists, but request or response translation is required.
- **Backend change**: no compatible endpoint exists, or the backend lifecycle conflicts with the frontend workflow.

## Authentication

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `POST /api/v1/auth/register/` | `authService.register()` | Adapter | Requires `email`, `password`, `confirm_password`, `first_name`, `last_name` and `role`; optional `phone_number` and `google_id_token`. The password is mandatory — there is no default. Frontend sends `firstName`/`lastName`/`confirmPassword` and maps lowercase roles to uppercase. |
| `POST /api/v1/auth/google/identity/` | `authService.resolveGoogleIdentity()` | Direct | Public endpoint. Verifies a Google ID token server-side and returns only `email`, `first_name`, `last_name`. Used to prefill the registration form. |
| `POST /api/v1/auth/login/` | `authService.login()` | Adapter | Backend accepts email only; frontend currently accepts email or phone. Store access and refresh tokens and map the returned user to `Student`. |
| `POST /api/v1/auth/refresh/` | Shared HTTP client | Adapter | Refresh access token on an authenticated request failure. |
| `GET /api/v1/auth/me/` | `authService.getSession()` | Adapter | Map backend `User` to the frontend `Student` type. |
| `PATCH /api/v1/auth/me/` | `authService.updateProfile()` | Adapter | Frontend fields differ from backend fields and the backend only supports first name, last name, and phone number. |
| `POST /api/v1/auth/change-password/` | No current frontend service method | Adapter | Add a profile security action when the frontend exposes password changes. |
| No endpoint | `authService.logout()` | Local only | Clear local tokens. Server-side logout/token blacklisting is not currently implemented. |

### Registration passwords

`PASSWORD_MIN_LENGTH` (env `DJANGO_PASSWORD_MIN_LENGTH`, default 10) is enforced server-side by
Django's `MinimumLengthValidator`, plus similarity-to-name, common-password and all-numeric
validators. Passwords are never trimmed, and the confirmation is compared verbatim. The frontend
mirrors the length and all-numeric rules for instant feedback; the server remains authoritative.

### Google sign-up

Google is used for one purpose: proving who the person is so their first and last name can be
filled in. The flow is:

1. The browser loads Google Identity Services and returns an **ID token** (public client ID only —
   no client secret is involved).
2. The token goes to `POST /api/v1/auth/google/identity/`, where the signature is checked against
   Google's JWKS (RS256) along with `aud`, `iss`, `exp`, `iat`, `sub` and `email_verified`.
3. Only `email`, `first_name` and `last_name` are returned. Photo, locale, birthday and every other
   profile claim are discarded.
4. `POST /api/v1/auth/register/` receives the same token and re-verifies it. The token's email and
   names take precedence over anything the client sent, and the user is stored with
   `registration_source=GOOGLE` and their Google `sub`.

Settings: `GOOGLE_OAUTH_CLIENT_ID` (required to enable the feature) and
`GOOGLE_ALLOWED_EMAIL_DOMAIN` (optional, restricts sign-up to one email domain). When the client
ID is empty the endpoint reports that Google sign-in is not configured.

## Drivers

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/drivers/me/` | Driver profile screens | Adapter | Backend profile fields differ from frontend `Driver`; rating and total trips are unavailable. |
| `PATCH /api/v1/drivers/availability/` | Driver availability UI | Adapter | Translate frontend availability values if needed. |
| `PATCH /api/v1/drivers/payout/` | `PayoutDetailsCard` (driver profile) | Adapter | Saves the bank account students transfer fares to. All three fields (`bank_name`, `account_number`, `account_name`) are required together; `account_number` is normalised to digits and must have at least 10. Exposed as `has_payout_details` on the profile. |
| `GET /api/v1/trips/available/` | Driver request queue | Adapter | Online drivers can list pending, unassigned trips. Map backend trip fields into the frontend driver request shape. |
| No endpoint | `driverService.findDriverForRoute()` | Backend change | The frontend expects route matching and a selected driver; Django exposes pending-trip discovery but not route matching. |

## Groups

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/groups/` | `groupService.getGroups()` | Adapter | Backend returns string locations, capacity, and `member_count`; frontend expects structured locations, members, status, and group codes. Also returns `bought_seats` and `seats_filled` (members + bought seats, capped at capacity). |
| `POST /api/v1/groups/` | `groupService.createGroup()` | Adapter | Map `CampusLocation` values to strings. Capacity is always 4: the backend rejects any other value and defaults to 4 when omitted. Backend requires a group name. |
| `POST /api/v1/groups/{id}/join/` | `groupService.joinGroup()` | Adapter | Backend accepts no member payload and creates one membership for the authenticated user; frontend tracks seat counts and member metadata. Joins are refused once members plus bought seats reach 4. |
| `POST /api/v1/groups/{id}/leave/` | `groupService.leaveGroup()` | Adapter | A member can leave before a trip is committed; an empty group is removed. A still-`PENDING` trip is cancelled when the group drops below 4/4. |
| `POST /api/v1/groups/{id}/cancel/` | `groupService.cancelGroup()` | Adapter | The creator can cancel an uncommitted group; pending related trips are cancelled before the group is removed. |
| `POST /api/v1/groups/{id}/buyout/` | `groupService.buyOutSeats()` | Adapter | `seats` must equal **all** remaining seats (4 − seats filled), otherwise the group would stay under 4/4. Creates a `PENDING` buyout intent whose seats count as filled, which flips the group to `FULL` and makes it dispatchable. |
| No endpoint | `groupService.getGroupsByRoute()` | Adapter | Fetch all groups and filter locally, or add backend route filtering. |
| No endpoint | `groupService.updateStatus()` | Backend change | Group lifecycle status is frontend-only. |
| No endpoint | `groupService.simulatePassengerJoin()` | Mock only | Simulation behavior should be removed from production integration. |

## Trips

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/trips/` | `tripService.getTrips()` | Adapter | Backend returns trips created by the current student only; response fields and statuses differ. |
| `GET /api/v1/trips/available/` | `tripService.getAvailableTrips()` | Adapter | Driver queue is filtered to groups that are `FULL` (4/4 members, or members plus bought seats). |
| `POST /api/v1/trips/` | `tripService.createTrip()` | Adapter | Requires group ID, string locations and fare. The group must be dispatchable (4/4 or bought out) and must not already have an active trip; it creates a `PENDING` trip rather than assigning a driver. |
| `POST /api/v1/trips/{id}/accept/` | Driver trip acceptance | Adapter | Endpoint exists, but drivers have no endpoint to discover pending trip IDs. |
| `POST /api/v1/trips/{id}/start/` | `tripService.updateStatus()` | Backend change | Endpoint is driver-only; frontend simulation also advances statuses outside the driver role. |
| `POST /api/v1/trips/{id}/complete/` | `tripService.updateStatus()` | Adapter | Compatible only for the assigned driver and after `IN_PROGRESS`. |
| `POST /api/v1/trips/{id}/cancel/` | `tripService.cancelTrip()` | Adapter | Student-owned pending trips can be cancelled; accepted and in-progress trips remain protected. |
| No endpoint | `tripService.getTrip()` | Backend change | No single-trip detail endpoint exists; the frontend can only filter an already-loaded list. |
| No endpoint | `tripService.assignDriver()` | Backend change | No driver matching or assignment endpoint exists. |
| No endpoint | `tripService.submitRating()` | Backend change | No trip rating model or endpoint exists. |

## Payments

Rydepus has no payment gateway. A student pays their assigned driver by hand —
cash or a direct bank transfer — then marks the trip paid; the driver confirms
receipt (or reports it never arrived). There is no provider reference, and the
in-app wallet is a frontend placeholder only.

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/payments/` | `paymentService.getPayments()` (student history) | Adapter | Returns the student's own records, newest first, with `payer_name`, `method` and `awaiting_confirmation` for display. |
| `POST /api/v1/payments/` | `paymentService.processPayment()` (called by `ManualPaymentCard`) | Adapter | Any group member may pay their own seat once a driver is assigned (`ACCEPTED`, `IN_PROGRESS`, `COMPLETED`). Requires `method` (`CASH` or `BANK_TRANSFER`); amount must equal the trip fare. Transfer requires the driver's saved payout details. Always created `PENDING`. |
| `GET /api/v1/payments/collectable/` | `paymentService.getCollectablePayments()` (driver) | Adapter | The driver's own trip fares, pending ones first. |
| `POST /api/v1/payments/{id}/confirm/` | `paymentService.confirmPayment()` (driver) | Adapter | Sets `SUCCESSFUL` and records `confirmed_by`/`confirmed_at`. Idempotent; the row is locked so a confirm and reject cannot race. |
| `POST /api/v1/payments/{id}/reject/` | `paymentService.rejectPayment()` (driver) | Adapter | Sets `FAILED` when the money never arrived, so the student can pay again. |
| `GET /api/v1/trips/` → `driver_bank` | `ManualPaymentCard` transfer option | Adapter | Present only for trips with an assigned driver who has complete payout details; otherwise `null`, and the frontend offers cash only. |
| `POST /api/v1/groups/{id}/buyout/` | `groupService.buyOutSeats()` (via `useApp().buyOutGroup`) | Backend change | The buyout seats are counted immediately; no provider confirmation is required for the group to become dispatchable. |

## Notifications

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/notifications/` | No frontend service yet | Adapter | Add a notification service and map notification records into frontend state. Backend currently restricts this to students. |
| `PATCH /api/v1/notifications/{id}/read/` | No frontend service yet | Adapter | Add a mark-read method. |

## Shared endpoints

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/health/` | Deployment or smoke check | Direct | Public database-backed health check. |
| `/api/schema/` | API tooling | Direct | OpenAPI schema endpoint. |
| `/api/docs/` | Developer tooling | Direct | Swagger UI. |

## Integration blockers

The frontend cannot be switched from the mock backend to HTTP safely until these contracts are resolved:

1. Driver trip discovery and route matching.
2. Group membership, leaving, cancellation, and buyout behavior.
3. Student trip cancellation and the complete trip lifecycle.
4. Trip ratings.
5. Manual payment confirmation on the driver side (cash/bank transfer), and a decision on whether the in-app wallet will ever hold real balances.
6. Consistent group, trip, driver, and payment response shapes.
7. A decision on whether notifications must support drivers as well as students.

The next phase should identify and prioritize the production hardening changes for these contracts before creating the real frontend HTTP integration layer.
