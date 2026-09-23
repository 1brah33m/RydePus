/**
 * Core domain types for the Rydepus app.
 *
 * These mirror the future backend API contract. The frontend only displays
 * state produced by the (mock) backend — it never enforces business rules
 * like capacity limits or driver matching.
 */

export type GroupStatus =
  | 'WAITING'
  | 'FULL'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'IN_TRIP'
  | 'COMPLETED'
  | 'CANCELLED'

export type TripStatus =
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'

/** The account kind a user signs up with; drives which dashboard they land on. */
export type UserRole = 'student' | 'driver'

/** A predefined campus pickup/drop-off point. */
export interface CampusLocation {
  id: string
  name: string
}

/** A registered student. */
export interface Student {
  id: string
  fullName: string
  department: string
  faculty: string
  level: string
  phone: string
  email: string
  matricNumber?: string
}

/** A driver who applied to operate on campus. */
export interface DriverApplication {
  id: string
  fullName: string
  email: string
  phone: string
  plateNumber: string
  /** Uploaded permit/license file name (demo). */
  licenseFile: string | null
  status: 'pending' | 'approved'
  createdAt: number
}

export interface DriverRegistrationPayload {
  fullName: string
  email: string
  phone: string
  plateNumber: string
  licenseFile: string | null
}

/** A keke driver. */
export interface Driver {
  id: string
  name: string
  phone: string
  plateNumber: string
  kekeIdentifier: string
  rating: number
  totalTrips: number
}

/** A priority ride dispatched to the driver queue (e.g. a fully-funded buyout). */
export interface DriverDispatch {
  id: string
  kind: 'FULLY_FUNDED'
  groupId: string
  groupCode: string
  pickup: CampusLocation
  destination: CampusLocation
  /** Total seats in the group (always full for a funded dispatch). */
  seats: number
  /** Total fare the driver stands to collect. */
  fare: number
  createdAt: string
  acknowledged?: boolean
}

/** A single passenger seat-holder inside a group. */
export interface GroupMember {
  id: string
  name: string
  /** Number of seats this member occupies (1, or 4 when paying for all seats). */
  seats: number
  /** True when the member is the signed-in student. */
  isCurrentUser?: boolean
}

/** A group of students sharing one keke ride. Capacity is enforced by the backend. */
export interface Group {
  id: string
  code: string
  pickup: CampusLocation
  destination: CampusLocation
  members: GroupMember[]
  maxSize: number
  status: GroupStatus
  createdAt: string
  /** ISO timestamp when the group expects to depart; the UI shows a live countdown to it. */
  departsAt?: string
  tripId?: string
  /** True when a member paid to fill the remaining seats (instant departure). */
  fullyFunded?: boolean
}

/** A ride shared by a group with an assigned driver. */
export interface Trip {
  id: string
  code: string
  groupId?: string
  pickup: CampusLocation
  destination: CampusLocation
  status: TripStatus
  driverId?: string
  driver?: Driver
  requestedAt: string
  startedAt?: string
  completedAt?: string
  fare: number
  rating?: number
  comment?: string
}

/** A payment record. */
export interface Payment {
  id: string
  reference: string
  groupId?: string
  amount: number
  seats: number
  currency: string
  status: PaymentStatus
  method: string
  createdAt: string
}

export interface RegisterPayload {
  fullName: string
  email: string
  /** Kept required for the shared auth contract; may be an empty string. */
  department?: string
  /** Optional in the quick-student flow. */
  faculty?: string
  level?: string
  phone?: string
  password?: string
  matricNumber?: string
}

export interface PaymentRequest {
  amount: number
  seats: number
  currency: string
  method: string
  metadata?: {
    pickupId?: string
    destinationId?: string
    groupId?: string
  }
}

export interface PaymentResult {
  payment: Payment
  reference: string
  status: 'SUCCESS' | 'FAILED'
}

/** Minimal latency simulation for mock services. */
export interface ServiceResult<T> {
  data: T
}