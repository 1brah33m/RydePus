/**
 * Google sign-in for registration.
 *
 * Flow:
 *   1. Load Google Identity Services (GIS) from Google's CDN.
 *   2. Let the user pick an account in Google's own popup.
 *   3. Keep the returned ID token and hand it to the backend.
 *
 * The ID token is the only thing this app ever receives from Google. It is not
 * decoded or trusted here — the backend verifies the signature against Google's
 * JWKS and decides which name/email belong to the account. Nothing from the
 * Google profile is read on the client.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GIS_LOAD_TIMEOUT_MS = 10_000

/** Public OAuth client id (safe to ship in the bundle). No client secret here. */
const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''

export class GoogleSignInError extends Error {}

/** Identity fields the backend is willing to take from a verified token. */
export interface VerifiedGoogleIdentity {
  email: string
  first_name: string
  last_name: string
}

export function isGoogleSignInConfigured(): boolean {
  return CLIENT_ID.length > 0
}

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (r: GoogleCredentialResponse) => void; cancel_on_tap_outside?: boolean }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null

/** Load GIS once per page and return its `google.accounts.id` namespace. */
function loadGoogleIdentityServices(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    const script = existing ?? document.createElement('script')

    const timer = setTimeout(() => {
      scriptPromise = null
      reject(new GoogleSignInError('Google sign-in took too long to load. Check your connection.'))
    }, GIS_LOAD_TIMEOUT_MS)

    const onLoad = () => {
      clearTimeout(timer)
      const id = window.google?.accounts?.id
      if (!id) {
        scriptPromise = null
        reject(new GoogleSignInError('Google sign-in could not be initialised.'))
        return
      }
      resolve(id)
    }

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onLoad, { once: true })
    } else {
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      script.addEventListener('load', onLoad, { once: true })
      script.addEventListener('error', () => {
        clearTimeout(timer)
        scriptPromise = null
        reject(new GoogleSignInError('Google sign-in is unavailable right now.'))
      }, { once: true })
      document.head.appendChild(script)
    }
  })

  return scriptPromise
}

/**
 * Open Google's account chooser and resolve with a signed ID token.
 *
 * Google renders its own button into an offscreen container; clicking it
 * programmatically keeps our styled button as the visible trigger while still
 * using Google's real popup (and its real origin checks).
 */
export async function requestGoogleIdToken(): Promise<string> {
  if (!isGoogleSignInConfigured()) {
    throw new GoogleSignInError('Google sign-in is not configured for this app yet.')
  }

  const googleId = await loadGoogleIdentityServices()

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div')
    // Offscreen rather than display:none — Google needs a laid-out element.
    host.style.position = 'fixed'
    host.style.left = '-10000px'
    host.style.top = '0'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)

    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      window.setTimeout(() => host.remove(), 0)
      action()
    }

    const timer = window.setTimeout(() => {
      finish(() => reject(new GoogleSignInError('Google sign-in was cancelled. Please try again.')))
    }, 5 * 60_000)

    googleId.initialize({
      client_id: CLIENT_ID,
      cancel_on_tap_outside: true,
      callback: (response) => {
        window.clearTimeout(timer)
        if (response.credential) {
          finish(() => resolve(response.credential as string))
        } else {
          finish(() => reject(new GoogleSignInError('Google did not return an identity token.')))
        }
      },
    })

    googleId.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: '240',
    })

    // Google mounts its button asynchronously inside the container.
    const clickWhenReady = (attemptsLeft: number) => {
      const trigger = host.querySelector<HTMLElement>('.g_id_signin > div')
      if (trigger) {
        trigger.click()
        return
      }
      if (attemptsLeft <= 0) {
        window.clearTimeout(timer)
        finish(() => reject(new GoogleSignInError('Google sign-in could not be started.')))
        return
      }
      window.setTimeout(() => clickWhenReady(attemptsLeft - 1), 100)
    }
    clickWhenReady(50)
  })
}
