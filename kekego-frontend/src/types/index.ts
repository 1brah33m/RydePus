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
  | 'PENDING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'

/** Rides are settled by hand: cash handed over, or a direct transfer. */
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER'

/** A driver's bank account, shown to students paying by direct transfer. */
export interface BankDetails {
  bankName: string
  accountNumber: string
  accountName: string
}

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
  /** Where students should send a direct bank transfer. Absent until the driver saves it. */
  bankDetails?: BankDetails
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

/** A ride a driver accepted and is currently completing (blocks further accepts). */
export interface DriverRide {
  id: string
  driverId: string
  pickup: string
  destination: string
  /** Number of passengers in this ride; the confirmation quota is 2 of them. */
  passengerSeats: number
  status: 'active' | 'awaiting_confirmation' | 'completed'
  /** Distinct IDs of passengers who attested the ride is complete. */
  markedByPassengers: string[]
  /** True once the driver attests the ride is complete. */
  driverMarked: boolean
  acceptedAt: string
  completedAt?: string
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

/** A group of students sharing one keke ride. Always a 4-seat request. */
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
  /** Seats covered by a buyout payment; they count as filled slots. */
  boughtSeats: number
  /** Occupied slots: joined members plus bought-out seats (capped at maxSize). */
  seatsFilled: number
  /** Seats still open to other passengers or to a buyout. */
  remainingSeats: number
  /**
   * Server-priced fare for one seat on this route, in naira. Computed by the
   * backend from the group's coordinates; the UI only displays it.
   */
  farePerSeat: number
  /** The full-ride total: farePerSeat * maxSize. */
  fareTotal: number
  /**
   * True when the signed-in member has already paid for their own seat through a
   * buyout, so a further buyout only bills the extra empty seats.
   */
  ownSeatPaid: boolean
  /** True when the group may be dispatched to drivers (4/4, or bought out). */
  isDispatchable: boolean
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
  /** Passengers riding on this trip; always 1 per group member. */
  passengerCount?: number
  rating?: number
  comment?: string
  /** Distinct IDs of passengers who attested the ride is complete (>= 2 required). */
  completedByStudentIds: string[]
  /** True once the driver attests the ride is complete. */
  driverMarkedComplete?: boolean
}

/** A payment record. */
export interface Payment {
  id: string
  reference: string
  tripId?: string
  groupId?: string
  amount: number
  seats: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  /** Name of the student who paid. */
  payerName?: string
  /** ISO timestamp of when the payment was settled. */
  confirmedAt?: string
  createdAt: string
}

export interface RegisterPayload {
  /** Both names are required by the backend; the user types them or Google fills them. */
  firstName: string
  lastName: string
  email: string
  /** Always required — there is no default or generated password. */
  password: string
  /** Must match `password` exactly. */
  confirmPassword: string
  /** Present only when the name/email came from a verified Google ID token. */
  googleIdToken?: string
  /** Kept required for the shared auth contract; may be an empty string. */
  department?: string
  /** Optional in the quick-student flow. */
  faculty?: string
  level?: string
  phone?: string
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