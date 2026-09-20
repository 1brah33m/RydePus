# API to Frontend Mapping

This document maps the implemented Django API to the current frontend services. It is the integration boundary for replacing the frontend mock backend.

## Classification

- **Direct**: the existing endpoint can support the frontend method with only a shared HTTP client.
- **Adapter**: the endpoint exists, but request or response translation is required.
- **Backend change**: no compatible endpoint exists, or the backend lifecycle conflicts with the frontend workflow.

## Authentication

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `POST /api/v1/auth/register/` | `authService.register()` | Adapter | Map `fullName` to `first_name`/`last_name`, `phone` to `phone_number`, and lowercase frontend roles to uppercase backend roles. |
| `POST /api/v1/auth/login/` | `authService.login()` | Adapter | Backend accepts email only; frontend currently accepts email or phone. Store access and refresh tokens and map the returned user to `Student`. |
| `POST /api/v1/auth/refresh/` | Shared HTTP client | Adapter | Refresh access token on an authenticated request failure. |
| `GET /api/v1/auth/me/` | `authService.getSession()` | Adapter | Map backend `User` to the frontend `Student` type. |
| `PATCH /api/v1/auth/me/` | `authService.updateProfile()` | Adapter | Frontend fields differ from backend fields and the backend only supports first name, last name, and phone number. |
| `POST /api/v1/auth/change-password/` | No current frontend service method | Adapter | Add a profile security action when the frontend exposes password changes. |
| No endpoint | `authService.logout()` | Local only | Clear local tokens. Server-side logout/token blacklisting is not currently implemented. |

## Drivers

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/drivers/me/` | Driver profile screens | Adapter | Backend profile fields differ from frontend `Driver`; rating and total trips are unavailable. |
| `PATCH /api/v1/drivers/availability/` | Driver availability UI | Adapter | Translate frontend availability values if needed. |
| `GET /api/v1/trips/available/` | Driver request queue | Adapter | Online drivers can list pending, unassigned trips. Map backend trip fields into the frontend driver request shape. |
| No endpoint | `driverService.findDriverForRoute()` | Backend change | The frontend expects route matching and a selected driver; Django exposes pending-trip discovery but not route matching. |

## Groups

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/groups/` | `groupService.getGroups()` | Adapter | Backend returns string locations, capacity, and `member_count`; frontend expects structured locations, members, status, and group codes. |
| `POST /api/v1/groups/` | `groupService.createGroup()` | Adapter | Map `CampusLocation` values to strings and map seat count to backend capacity. Backend requires a group name. |
| `POST /api/v1/groups/{id}/join/` | `groupService.joinGroup()` | Adapter | Backend accepts no member payload and creates one membership for the authenticated user; frontend tracks seat counts and member metadata. |
| `POST /api/v1/groups/{id}/leave/` | `groupService.leaveGroup()` | Adapter | A member can leave before a trip is committed; an empty group is removed. |
| `POST /api/v1/groups/{id}/cancel/` | `groupService.cancelGroup()` | Adapter | The creator can cancel an uncommitted group; pending related trips are cancelled before the group is removed. |
| `POST /api/v1/groups/{id}/buyout/` | `groupService.buyOutRemainingSeats()` | Adapter | Creates a pending group-buyout payment intent after validating membership and remaining capacity; group seats are not filled until provider confirmation exists. |
| No endpoint | `groupService.getGroupsByRoute()` | Adapter | Fetch all groups and filter locally, or add backend route filtering. |
| No endpoint | `groupService.updateStatus()` | Backend change | Group lifecycle status is frontend-only. |
| No endpoint | `groupService.simulatePassengerJoin()` | Mock only | Simulation behavior should be removed from production integration. |

## Trips

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/trips/` | `tripService.getTrips()` | Adapter | Backend returns trips created by the current student only; response fields and statuses differ. |
| `POST /api/v1/trips/` | Partial support for trip creation | Adapter | Backend requires group ID, string locations, and fare. It creates a `PENDING` trip rather than assigning a driver. |
| `POST /api/v1/trips/{id}/accept/` | Driver trip acceptance | Adapter | Endpoint exists, but drivers have no endpoint to discover pending trip IDs. |
| `POST /api/v1/trips/{id}/start/` | `tripService.updateStatus()` | Backend change | Endpoint is driver-only; frontend simulation also advances statuses outside the driver role. |
| `POST /api/v1/trips/{id}/complete/` | `tripService.updateStatus()` | Adapter | Compatible only for the assigned driver and after `IN_PROGRESS`. |
| `POST /api/v1/trips/{id}/cancel/` | `tripService.cancelTrip()` | Adapter | Student-owned pending trips can be cancelled; accepted and in-progress trips remain protected. |
| No endpoint | `tripService.getTrip()` | Backend change | No single-trip detail endpoint exists; the frontend can only filter an already-loaded list. |
| No endpoint | `tripService.assignDriver()` | Backend change | No driver matching or assignment endpoint exists. |
| No endpoint | `tripService.submitRating()` | Backend change | No trip rating model or endpoint exists. |

## Payments

| Endpoint | Frontend usage | Classification | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/payments/` | Payment history | Adapter | Backend payment shape differs from frontend `Payment`. |
| `POST /api/v1/payments/` | Trip payment flow | Adapter | Requires a completed trip, validates the amount against the trip fare, and prevents duplicate active payments. |
| `POST /api/v1/groups/{id}/buyout/` | `paymentService.processPayment()` | Backend change | Creates a pending intent only; provider processing, confirmation, reference, and final group fill are still required. |

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
5. Payment-provider processing and payment references.
6. Consistent group, trip, driver, and payment response shapes.
7. A decision on whether notifications must support drivers as well as students.

The next phase should identify and prioritize the production hardening changes for these contracts before creating the real frontend HTTP integration layer.
