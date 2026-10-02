/**
 * Shared HTTP client for the Rydepus Django API.
 *
 * - Base URL is configurable via VITE_API_BASE_URL (defaults to the local dev
 *   backend). Point it at your server host so phones on the LAN can reach it,
 *   e.g. VITE_API_BASE_URL=http://192.168.1.20:8000/api/v1
 * - Stores the JWT access/refresh pair so authService and future HTTP services
 *   never talk to the network directly.
 * - Transparently refreshes an expired access token once per failed request
 *   (single-flight) and retries the original call.
 * - Parses the backend error envelope `{ error: { code, message } }` into a
 *   plain Error with the server's human-readable message.
 */

const RAW_API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? ''

const API_BASE_URL: string =
  RAW_API_BASE_URL.replace(/\/+$/, '') || 'http://127.0.0.1:8000/api/v1'

/**
 * Vite inlines env values at BUILD time. If the deploy host never provided
 * VITE_API_BASE_URL we would otherwise ship a bundle pointing at 127.0.0.1,
 * which happens to work on the build machine and fails silently on every real
 * device (on a phone, 127.0.0.1 is the phone). Say so at build time instead.
 */
if (!RAW_API_BASE_URL) {
  const detail =
    import.meta.env.PROD
      ? 'No VITE_API_BASE_URL was set for this build, so requests fall back to http://127.0.0.1:8000/api/v1. Sign In will work on this machine only and fail on real devices. Set VITE_API_BASE_URL in the deploy environment and rebuild.'
      : 'No VITE_API_BASE_URL set; falling back to http://127.0.0.1:8000/api/v1 for local development.'
  console.warn(`[apiClient] ${detail}`)
}

const ACCESS_KEY = 'rydepus.jwt.access.v1'
const REFRESH_KEY = 'rydepus.jwt.refresh.v1'

function getStorageValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — keep session in memory only */
  }
}

function clearStorageValue(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  return getStorageValue(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return getStorageValue(REFRESH_KEY)
}

export function hasTokens(): boolean {
  return getAccessToken() !== null
}

export function setTokens(access: string, refresh: string): void {
  setStorageValue(ACCESS_KEY, access)
  setStorageValue(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  clearStorageValue(ACCESS_KEY)
  clearStorageValue(REFRESH_KEY)
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
  detail?: string
  message?: string
}

/** Extract the server's message from any error-shaped response body. */
function errorMessageFrom(body: ApiErrorBody | null, fallback: string): string {
  return body?.error?.message ?? body?.detail ?? body?.message ?? fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Attach the JWT access token. When set and a 401 occurs, retry after refresh. */
  auth?: boolean
}

/** Endpoints that must never trigger the auto-refresh retry. */
function isAuthRoot(path: string): boolean {
  return path.startsWith('/auth/')
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  let data: ApiErrorBody | unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    throw new Error(errorMessageFrom(data as ApiErrorBody | null, res.statusText || 'Request failed.'))
  }
  return data as T
}

let refreshing: Promise<boolean> | null = null

/**
 * Exchange the stored refresh token for a new access token. Returns true when
 * a fresh access token is available. Never throws.
 */
function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve(false)

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        })
        const data = (await res.json()) as { access?: string }
        if (!res.ok || !data.access) {
          clearTokens()
          return false
        }
        setStorageValue(ACCESS_KEY, data.access)
        return true
      } catch {
        clearTokens()
        return false
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

async function request<T>(path: string, options: RequestOptions, alreadyRetried = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.auth) {
    const access = getAccessToken()
    if (!access) throw new Error('You are not signed in.')
    headers.Authorization = `Bearer ${access}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    // A cross-origin block (CORS, HTTPS/HTTP mismatch, or an unreachable host)
    // surfaces here as an opaque TypeError with no status. Say something
    // actionable instead of the misleading "make sure the backend is running",
    // which is wrong for every deployed build.
    if (import.meta.env.PROD) {
      throw new Error(
        'Could not reach the Rydepus API. This is usually the API address being wrong, or the server not allowing this site (CORS).',
      )
    }
    throw new Error('Could not reach the Rydepus API. Make sure the backend is running.')
  }

  if (
    res.status === 401 &&
    options.auth &&
    !alreadyRetried &&
    !isAuthRoot(path)
  ) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return request<T>(path, options, true)
    }
  }

  return parseResponse<T>(res)
}

export function apiGet<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' })
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<T> {
  return request<T>(path, { ...options, method: 'POST', body })
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<T> {
  return request<T>(path, { ...options, method: 'PATCH', body })
}

export function apiDelete<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' })
}

/** Liveness/DB check — the only public backend endpoint. */
export async function apiHealth(): Promise<{ status: string }> {
  return apiGet<{ status: string }>('/health/')
}

export const apiClient = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  delete: apiDelete,
  health: apiHealth,
  setTokens,
  clearTokens,
  hasTokens,
  getAccessToken,
}