/**
 * Smoke test for the mock service layer.
 * Run with: npx tsx scripts/smoke.ts
 *
 * Validates the core business flows outside of the browser:
 * auth -> create/join group -> full -> driver search -> trip -> completed.
 */
async function run() {
  // ---- localStorage shim (services persist to localStorage) ----
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
    configurable: true,
  })

  const backend = await import('../src/services/mockBackend')
  const { authService } = await import('../src/services/authService')
  const { groupService } = await import('../src/services/groupService')
  const { tripService } = await import('../src/services/tripService')
  const { paymentService } = await import('../src/services/paymentService')
  const { CAMPUS_LOCATIONS, FARE_PER_SEAT, DEMO_ACCOUNT, DEMO_DRIVER_ACCOUNT } = await import('../src/mock/data')

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`)
    console.log(`  ok - ${msg}`)
  }

  console.log('== seed state ==')
  const db = backend.initDb()
  assert(db.groups.some((g) => g.code === 'G001' && g.members.length === 3), 'G001 seeded with 3/4')
  assert(db.groups.some((g) => g.code === 'G003' && g.status === 'SEARCHING_DRIVER'), 'G003 seeded searching')

  console.log('== auth ==')
  const demo = await authService.login(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)
  assert(demo.email === DEMO_ACCOUNT.email, 'demo login returns Quadri')
  assert(authService.getRole() === 'student', 'student login stores role "student"')

  const driver = await authService.login(DEMO_DRIVER_ACCOUNT.email, DEMO_DRIVER_ACCOUNT.password)
  assert(driver.email === DEMO_DRIVER_ACCOUNT.email, 'demo driver login succeeds')
  assert(authService.getRole() === 'driver', 'driver login stores role "driver"')

  // Log back in as the student before continuing the shared flows.
  await authService.login(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)
  assert(authService.getRole() === 'student', 're-login as student stores "student"')

  let registerFailed = false
  try {
    await authService.register({
      fullName: 'Test Student',
      department: 'Maths',
      faculty: 'Science',
      level: '200',
      phone: '08100000000',
      email: 'test.student@uni.edu.ng',
      password: 'password123',
    })
  } catch {
    registerFailed = true
  }
  assert(!registerFailed, 'register new student succeeds')
  assert(authService.getRole() === 'student', 'student registration stores role "student"')

  let registerDriverFailed = false
  try {
    await authService.register(
      {
        fullName: 'Test Driver',
        department: 'Transport',
        faculty: 'Others',
        level: '',
        phone: '08122222222',
        email: 'test.driver@uni.edu.ng',
        password: 'password123',
      },
      'driver',
    )
  } catch {
    registerDriverFailed = true
  }
  assert(!registerDriverFailed, 'register driver succeeds')
  assert(authService.getRole() === 'driver', 'driver registration stores role "driver"')

  let duplicateFailed = false
  try {
    await authService.register({
      fullName: 'Test Student 2',
      department: 'Maths',
      faculty: 'Science',
      level: '100',
      phone: '08111111111',
      email: 'test.student@uni.edu.ng',
      password: 'password123',
    })
  } catch {
    duplicateFailed = true
  }
  assert(duplicateFailed, 'duplicate email rejected')

  const eng = CAMPUS_LOCATIONS.find((l) => l.id === 'engineering')!
  const gate = CAMPUS_LOCATIONS.find((l) => l.id === 'main-gate')!

  console.log('== groups ==')
  const created = await groupService.createGroup({
    pickup: eng,
    destination: gate,
    member: {
      id: 'm-me',
      name: 'Test Student',
      seats: 1,
      isCurrentUser: true,
    },
  })
  assert(created.members.length === 1 && created.status === 'WAITING', 'createGroup -> WAITING 1/4')

  await groupService.joinGroup(created.id, { id: 'm-g1', name: 'Ghost A', seats: 1 })
  await groupService.joinGroup(created.id, { id: 'm-g2', name: 'Ghost B', seats: 1 })
  const joined3 = await groupService.joinGroup(created.id, { id: 'm-g3', name: 'Ghost C', seats: 1 })
  assert(joined3.members.length === 4, 'group reaches 4 members')
  assert(joined3.status === 'FULL', 'group auto-transitions to FULL at 4/4')

  let overCapacity = false
  try {
    await groupService.joinGroup(created.id, { id: 'm-g4', name: 'Ghost D', seats: 1 })
  } catch {
    overCapacity = true
  }
  assert(overCapacity && created.maxSize === 4, 'cannot exceed 4 passengers')

  console.log('== pay for 4 seats ==')
  const pay4 = await groupService.createGroup({
    pickup: eng,
    destination: gate,
    member: {
      id: 'm-me4',
      name: 'Test Student',
      seats: 4,
      isCurrentUser: true,
    },
  })
  assert(pay4.status === 'FULL', 'createGroup with 4 seats is FULL immediately')
  const pay4Full = await groupService.updateStatus(pay4.id, 'FULL')
  assert(backend.groupSeatCount(pay4Full) === 4, 'pay-for-4 group occupies all seats')

  // Force the mock's 5% random failure off so the test is deterministic.
  const realRandom = Math.random
  Math.random = () => 0.99
  const payResult = await paymentService.processPayment({
    amount: FARE_PER_SEAT * 4,
    seats: 4,
    currency: 'NGN',
    method: 'card',
  })
  Math.random = realRandom
  assert(payResult.status === 'SUCCESS', 'mock payment succeeds')
  assert(payResult.payment.amount === FARE_PER_SEAT * 4, 'payment amount matches fare')

  console.log('== driver matching + trip ==')
  const trip = await tripService.assignDriver(pay4Full)
  assert(trip.status === 'DRIVER_ASSIGNED' && trip.driverId, 'trip created with assigned driver')

  const accepted = await tripService.updateStatus(trip.id, 'DRIVER_ACCEPTED')
  const inProgress = await tripService.updateStatus(trip.id, 'IN_PROGRESS')
  assert(inProgress.startedAt, 'trip.startedAt set when in progress')
  const completed = await tripService.updateStatus(trip.id, 'COMPLETED')
  assert(completed.completedAt, 'trip.completedAt set when completed')
  void accepted

  const rated = await tripService.submitRating(trip.id, 5, 'Great ride')
  assert(rated.rating === 5 && rated.comment === 'Great ride', 'rating saved')

  console.log('== cancel ==')
  const cancelled = await tripService.cancelTrip(trip.id)
  assert(cancelled.status === 'CANCELLED', 'cancelTrip marks trip cancelled')
  const dbAfter = backend.getDb()
  assert(!dbAfter.groups.some((g) => g.id === pay4Full.id), 'cancelled trip releases its group')

  console.log('\nAll smoke tests passed.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})