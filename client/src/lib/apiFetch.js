import { stackApp } from '../stack'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// 50s token cache — avoids a round-trip on every request while staying fresh
let _cachedToken = null
let _cacheExpiry  = 0

export async function getToken() {
  if (_cachedToken && Date.now() < _cacheExpiry) return _cachedToken

  if (stackApp) {
    try {
      const user = await stackApp.getUser()
      if (user) {
        const { accessToken } = await user.getAuthJson()
        if (accessToken) {
          _cachedToken = accessToken
          _cacheExpiry = Date.now() + 50_000
          localStorage.setItem('stack-auth-token', accessToken)
          console.debug('[apiFetch] token refreshed from Stack Auth, expires in 50s')
          return _cachedToken
        }
        console.warn('[apiFetch] getAuthJson returned no accessToken — user may not be signed in')
      } else {
        console.warn('[apiFetch] stackApp.getUser() returned null — falling back to localStorage')
      }
    } catch (err) {
      console.error('[apiFetch] getToken Stack Auth error:', err)
    }
  } else {
    console.warn('[apiFetch] stackApp not initialized — using localStorage token')
  }

  const lsToken = localStorage.getItem('stack-auth-token')
  if (!lsToken) {
    console.warn('[apiFetch] no token available — request will be unauthenticated')
    return null
  }
  // Decode JWT payload to check expiry before using stale localStorage token
  try {
    const payload = JSON.parse(atob(lsToken.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn('[apiFetch] localStorage token is expired, discarding')
      localStorage.removeItem('stack-auth-token')
      return null
    }
  } catch { /* unparseable token — discard */ }
  return lsToken
}

// Kept for App.jsx to eagerly prime the cache on sign-in
export function setAuthToken(token) {
  if (token) {
    _cachedToken = token
    _cacheExpiry = Date.now() + 50_000
    console.debug('[apiFetch] token primed from App.jsx sign-in')
  } else {
    _cachedToken = null
    _cacheExpiry = 0
    console.debug('[apiFetch] token cleared (sign-out)')
  }
}

export async function apiFetch(path, options = {}) {
  const method = options.method ?? 'GET'
  const token  = await getToken()

  if (!token) {
    console.warn(`[apiFetch] ${method} ${path} — no auth token, expect 401`)
  } else {
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      console.debug(`[apiFetch] token aud=${JSON.stringify(p.aud)} exp=${new Date(p.exp*1000).toISOString()} expired=${p.exp*1000 < Date.now()}`)
    } catch { /* ignore */ }
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    })
  } catch (networkErr) {
    console.error(`[apiFetch] ${method} ${path} — network error:`, networkErr)
    throw networkErr
  }

  if (!res.ok) {
    if (res.status === 401) {
      const errBody = await res.json().catch(() => ({}))
      console.warn(`[apiFetch] 401 on ${method} ${path} — reason: ${errBody.reason ?? 'unknown'} — busting cache`)
      _cachedToken = null
      _cacheExpiry = 0
      localStorage.removeItem('stack-auth-token')
      throw new Error(errBody.error ?? 'HTTP 401')
    } else {
      console.error(`[apiFetch] ${method} ${path} → HTTP ${res.status}`)
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  console.debug(`[apiFetch] ${method} ${path} → ${res.status}`)
  return res.json()
}

export async function uploadPhoto(roomId, logType, file) {
  console.debug(`[apiFetch] uploadPhoto room=${roomId} type=${logType} file=${file.name}`)
  const presign = await apiFetch('/api/photos/presign', {
    method: 'POST',
    body: JSON.stringify({ roomId, logType, contentType: file.type }),
  })
  try {
    const uploadRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!uploadRes.ok) throw new Error(`R2 upload failed: HTTP ${uploadRes.status}`)
    console.debug(`[apiFetch] photo uploaded → ${presign.publicUrl}`)
  } catch (err) {
    console.error('[apiFetch] uploadPhoto R2 PUT failed:', err)
    throw err
  }
  return presign.publicUrl
}
