import type { CampusLocation } from '../types'

/**
 * Campus pickup/drop-off points.
 *
 * This is the single source of truth for route options. The backend stores a
 * location by its display name (free text), so the frontend maps both its own
 * ids AND backend name strings back to a CampusLocation via findLocation().
 */

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  { id: 'main-gate', name: 'Main Gate' },
  { id: 'soa', name: 'School of Agriculture' },
  { id: 'EVM', name: 'Faculty of Environmental Sciences' },
  { id: 'ECE', name: 'ECE Department' },
  { id: 'hostelFemale', name: 'Hostel Area(Female)' },
  { id: 'hostelMale', name: 'Hostel Area(Male)' },
  { id: 'lecture-theatre', name: 'Lecture Theatre Hall' },
  { id: 'staff-club', name: 'Staff Club' },
  { id: 'CHE', name: 'CHE Department' },
  { id: 'main-mosque', name: 'Main University Mosque' },
]

/** Approximate coordinates so route distances (and fares) can be computed. */
export const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'main-gate': { lat: 7.7945, lng: 4.5251 },
  soa: { lat: 7.7899, lng: 4.5189 },
  EVM: { lat: 7.7951, lng: 4.5108 },
  ECE: { lat: 7.8002, lng: 4.518 },
  hostelFemale: { lat: 7.7852, lng: 4.5263 },
  hostelMale: { lat: 7.7891, lng: 4.5281 },
  'lecture-theatre': { lat: 7.7924, lng: 4.5161 },
  'staff-club': { lat: 7.8001, lng: 4.5222 },
  CHE: { lat: 7.8022, lng: 4.5191 },
  'main-mosque': { lat: 7.7874, lng: 4.5234 },
}

const byId = new Map(CAMPUS_LOCATIONS.map((l) => [l.id, l] as const))

/** Resolve a campus location by its frontend id. */
export function getLocation(id: string): CampusLocation | undefined {
  return byId.get(id)
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Resolve a raw string (a frontend id OR a backend display name like
 * "Faculty of Engineering") into a CampusLocation. Falls back to a synthetic
 * location so free-text backend values never crash the UI.
 */
export function findLocation(raw: string): CampusLocation {
  const byIdHit = getLocation(raw.trim())
  if (byIdHit) return byIdHit

  const want = normalize(raw)
  const byName = CAMPUS_LOCATIONS.find((l) => normalize(l.name) === want)
  if (byName) return byName

  const fallback = { id: `loc-${want || 'unknown'}`, name: raw.trim() || 'Unknown' }
  if (want) {
    // Best-effort substring match (e.g. typo'd names from old seeds).
    const fuzzy = CAMPUS_LOCATIONS.find((l) => normalize(l.name).includes(want) || want.includes(normalize(l.name)))
    if (fuzzy) return fuzzy
  }
  return fallback
}

/** Coordinates for a raw location reference, or null when unknown. */
export function coordsFor(raw: string): { lat: number; lng: number } | null {
  return LOCATION_COORDS[findLocation(raw).id] ?? null
}