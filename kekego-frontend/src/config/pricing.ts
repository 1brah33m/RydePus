import { coordsFor, getLocation } from './locations'

/**
 * Dynamic route pricing.
 *
 * Fares are computed from the straight-line distance between campus points at
 * request time, then rounded to a friendly naira figure. This replaces the old
 * fixed per-seat constant that used to be seeded from the mock layer.
 */

export const CURRENCY = 'NGN'

/** A keke always leaves with four seats, and a group is always a 4-seat request. */
export const MAX_GROUP_SIZE = 4
export const GROUP_SEATS = MAX_GROUP_SIZE

const BASE_FARE = 100
const RATE_PER_KM = 120
const MIN_FARE = 150
const ROUNDING = 50

const EARTH_RADIUS_KM = 6371

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Straight-line distance between two campus points, in kilometres. */
export function distanceKm(pickupId: string, destinationId: string): number | null {
  const a = coordsFor(pickupId)
  const b = coordsFor(destinationId)
  if (!a || !b) return null

  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

/**
 * Fare per seat for a route. Uses distance when coordinates are known, and a
 * flat default otherwise.
 */
export function perSeatFare(pickupId: string, destinationId: string): number {
  const km = distanceKm(pickupId, destinationId)
  if (km === null) return MIN_FARE
  return Math.max(MIN_FARE, roundTo(BASE_FARE + km * RATE_PER_KM, ROUNDING))
}

/**
 * Total fare for a ride. Always four seats, since a group only reaches the
 * driver queue when all four slots are taken or paid for.
 */
export function groupFare(pickupId: string, destinationId: string): number {
  return perSeatFare(pickupId, destinationId) * GROUP_SEATS
}

/** Fare breakdown object for payment/review screens. */
export function fareQuote(pickupId: string, destinationId: string) {
  const perSeat = perSeatFare(pickupId, destinationId)
  return {
    perSeat,
    distanceKm: distanceKm(pickupId, destinationId),
    groupOfFour: groupFare(pickupId, destinationId),
  }
}

/** Convenience: fare for a route given two CampusLocation-ish ids. */
export function fareForRoute(pickupIdOrName: string, destinationIdOrName: string): number {
  const pickup = getLocation(pickupIdOrName)?.id ?? pickupIdOrName
  const destination = getLocation(destinationIdOrName)?.id ?? destinationIdOrName
  return perSeatFare(pickup, destination)
}