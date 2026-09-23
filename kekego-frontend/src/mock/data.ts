import type { CampusLocation, Driver, Group, Student, Trip } from '../types'

/** Capacity of a single keke. Business rule owned by the backend. */
export const MAX_GROUP_SIZE = 4

/** Fare per seat, in naira (mock). The real pricing is decided by the backend. */
export const FARE_PER_SEAT = 150

export const CURRENCY = 'NGN'

/** Predefined campus pickup/drop-off points. */
export const CAMPUS_LOCATIONS: CampusLocation[] = [
  { id: 'main-gate', name: 'Main Gate' },
  { id: 'engineering', name: 'Faculty of Engineering' },
  { id: 'soa', name: 'School of Agriculture' },
  { id: 'EVM', name: 'Faculty of Environmental Services' },
  { id: 'ECE', name: 'ECE Department' },
  { id: 'auditorium', name: 'Main Auditorium' },
  { id: 'middle-block', name: 'Middle Block' },
  { id: 'hostelFemale', name: 'Hostel Area(Female)' },
  { id: 'hostelMale', name: 'Hostel Area(Male)' },
  { id: 'library', name: 'Library' },
  { id: 'lecture-theatre', name: 'Lecture Theatre' },
  { id: 'staff-club', name: 'Staff Club' },
  { id: 'CHE', name: 'CHE Department' },
  { id: 'main-mosque', name: 'Main University Mosque' },
  { id: 'engineering-workshop', name: 'Engineering Workshop' },
]

export function getLocation(id: string): CampusLocation {
  return CAMPUS_LOCATIONS.find((l) => l.id === id) ?? CAMPUS_LOCATIONS[0]
}

/** Demo account so the app can be opened and explored instantly. */
export const DEMO_ACCOUNT = {
  email: 'demo@rydepus.app',
  password: 'password123',
}

/** Demo driver account so the driver dashboard is reachable via login. */
export const DEMO_DRIVER_ACCOUNT = {
  email: 'driver@rydepus.app',
  password: 'password123',
}

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'st-quadri',
    fullName: 'Quadri Adebayo',
    department: 'Computer Engineering',
    faculty: 'Engineering',
    level: '300',
    phone: '08123455600',
    email: 'demo@rydepus.app',
  },
  {
    id: 'st-aisha',
    fullName: 'Aisha Bello',
    department: 'Microbiology',
    faculty: 'Science',
    level: '200',
    phone: '08033445511',
    email: 'aisha.bello@uni.edu.ng',
  },
  {
    id: 'st-daniel',
    fullName: 'Daniel Okafor',
    department: 'Accounting',
    faculty: 'Management Sciences',
    level: '100',
    phone: '09055667722',
    email: 'daniel.okafor@uni.edu.ng',
  },
  {
    id: 'st-samuel',
    fullName: 'Samuel Eze',
    department: 'Law',
    faculty: 'Law',
    level: '400',
    phone: '07066778833',
    email: 'samuel.eze@uni.edu.ng',
  },
]

export const MOCK_DRIVERS: Driver[] = [
  {
    id: 'dr-musa',
    name: 'Musa Ibrahim',
    phone: '08031112233',
    plateNumber: 'JJJ 884 MKA',
    kekeIdentifier: 'KMK-04',
    rating: 4.8,
    totalTrips: 312,
  },
  {
    id: 'dr-tunde',
    name: 'Tunde Adewale',
    phone: '08134445566',
    plateNumber: 'AAA 102 KJA',
    kekeIdentifier: 'KMK-11',
    rating: 4.6,
    totalTrips: 208,
  },
  {
    id: 'dr-ibrahim',
    name: 'Ibrahim Danjuma',
    phone: '09057778899',
    plateNumber: 'KWW 774 MKA',
    kekeIdentifier: 'KMK-02',
    rating: 4.9,
    totalTrips: 428,
  },
]

/**
 * Seed pending groups. These simulate groups created by other students on
 * campus. G001 and G002 are joinable; G003 already reached a driver search.
 */
export function seedGroups(): Group[] {
  const now = Date.now()
  const minutes = (n: number) => new Date(now - n * 60_000).toISOString()
  const departs = (n: number) => new Date(now + n * 60_000).toISOString()

  return [
    {
      id: 'G001',
      code: 'G001',
      pickup: getLocation('engineering'),
      destination: getLocation('main-gate'),
      members: [
        { id: 'm-quadri', name: 'Quadri A.', seats: 1 },
        { id: 'm-aisha', name: 'Aisha B.', seats: 1 },
        { id: 'm-daniel', name: 'Daniel O.', seats: 1 },
      ],
      maxSize: MAX_GROUP_SIZE,
      status: 'WAITING',
      createdAt: minutes(4),
      departsAt: departs(14),
    },
    {
      id: 'G002',
      code: 'G002',
      pickup: getLocation('library'),
      destination: getLocation('hostelFemale'),
      members: [
        { id: 'm-samuel', name: 'Samuel E.', seats: 1 },
        { id: 'm-chioma', name: 'Chioma N.', seats: 1 },
      ],
      maxSize: MAX_GROUP_SIZE,
      status: 'WAITING',
      createdAt: minutes(8),
      departsAt: departs(9),
    },
    {
      id: 'G003',
      code: 'G003',
      pickup: getLocation('ECE'),
      destination: getLocation('main-gate'),
      members: [
        { id: 'm-yusuf', name: 'Yusuf K.', seats: 1 },
        { id: 'm-funke', name: 'Funke A.', seats: 1 },
        { id: 'm-kelechi', name: 'Kelechi O.', seats: 1 },
        { id: 'm-john', name: 'John P.', seats: 1 },
      ],
      maxSize: MAX_GROUP_SIZE,
      status: 'SEARCHING_DRIVER',
      createdAt: minutes(3),
      departsAt: departs(12),
    },
  ]
}

/**
 * Seed trip history so the Trips screen is demonstrable on first launch.
 * These are clearly mock records — the real backend owns trip history.
 */
export function seedTrips(): Trip[] {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000
  const beforeYesterday = Date.now() - 2 * 24 * 60 * 60 * 1000

  return [
    {
      id: 'T003',
      code: 'T003',
      pickup: getLocation('engineering'),
      destination: getLocation('hostelMale'),
      status: 'COMPLETED',
      driver: MOCK_DRIVERS[1],
      requestedAt: new Date(beforeYesterday).toISOString(),
      startedAt: new Date(beforeYesterday).toISOString(),
      completedAt: new Date(beforeYesterday).toISOString(),
      fare: FARE_PER_SEAT,
      rating: 5,
      comment: 'Fast and friendly.',
    },
    {
      id: 'T002',
      code: 'T002',
      pickup: getLocation('library'),
      destination: getLocation('engineering'),
      status: 'COMPLETED',
      driver: MOCK_DRIVERS[2],
      requestedAt: new Date(yesterday).toISOString(),
      startedAt: new Date(yesterday).toISOString(),
      completedAt: new Date(yesterday).toISOString(),
      fare: FARE_PER_SEAT,
      rating: 4,
    },
    {
      id: 'T001',
      code: 'T001',
      pickup: getLocation('EVM'),
      destination: getLocation('main-gate'),
      status: 'CANCELLED',
      driver: MOCK_DRIVERS[0],
      requestedAt: new Date(beforeYesterday).toISOString(),
      fare: FARE_PER_SEAT,
    },
  ]
}