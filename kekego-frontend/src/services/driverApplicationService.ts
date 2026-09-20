import type { DriverApplication, DriverRegistrationPayload } from '../types'

const APPLICATIONS_KEY = 'kekego.driver.applications.v1'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadApplications(): DriverApplication[] {
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY)
    return raw ? (JSON.parse(raw) as DriverApplication[]) : []
  } catch {
    return []
  }
}

function saveApplications(applications: DriverApplication[]) {
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications))
}

/**
 * Mock driver application store. Mirrors the future backend contract:
 * applications are persisted with a `pending` status awaiting review.
 */
export class DriverApplicationService {
  async submit(payload: DriverRegistrationPayload): Promise<DriverApplication> {
    await delay(900)

    const applications = loadApplications()
    const email = payload.email.trim().toLowerCase()
    if (applications.some((a) => a.email.toLowerCase() === email)) {
      throw new Error('A driver application already exists for this email.')
    }

    const application: DriverApplication = {
      id: crypto.randomUUID(),
      fullName: payload.fullName.trim(),
      email,
      phone: payload.phone.replace(/\D/g, ''),
      plateNumber: payload.plateNumber.trim().toUpperCase(),
      licenseFile: payload.licenseFile,
      status: 'pending',
      createdAt: Date.now(),
    }
    applications.push(application)
    saveApplications(applications)
    return application
  }
}

export const driverApplicationService = new DriverApplicationService()