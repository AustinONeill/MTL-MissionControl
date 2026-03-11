import { createMiddleware } from 'hono/factory'
import { createLocalJWKSet, jwtVerify } from 'jose'
import type { Env, HonoVariables, Role } from '../types'

const ROLE_HIERARCHY: Record<Role, number> = {
  gardener: 1,
  pest_control: 2,
  automation_engineer: 2,
  master_grower: 3,
  director: 4,
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

// Cache the JWKS in-memory for 10 minutes to avoid fetching on every request.
// createRemoteJWKSet caused WebSocket upgrade errors in the CF Worker runtime;
// fetching manually via fetch() + createLocalJWKSet is fully reliable.
let _jwksCache: ReturnType<typeof createLocalJWKSet> | null = null
let _jwksCacheExpiry = 0

async function getJWKS(jwksUrl: string): Promise<ReturnType<typeof createLocalJWKSet>> {
  if (_jwksCache && Date.now() < _jwksCacheExpiry) return _jwksCache

  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`)
  const jwks = await res.json() as { keys: object[] }

  _jwksCache = createLocalJWKSet(jwks)
  _jwksCacheExpiry = Date.now() + 10 * 60 * 1000  // 10 min
  return _jwksCache
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(
  async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header', code: 401 }, 401)
    }

    const token = authorization.slice(7)

    try {
      const JWKS = await getJWKS(c.env.STACK_AUTH_JWKS_URL)

      const { payload } = await jwtVerify(token, JWKS, {
        audience: c.env.STACK_AUTH_PROJECT_ID,
      })

      const role = (payload['role'] as Role) ?? 'gardener'
      const userId = payload.sub ?? ''
      const email = (payload['email'] as string) ?? ''
      const name = (payload['name'] as string) ?? email

      c.set('user', { userId, role, email, name })
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name ?? 'unknown'
      const msg     = (err as { message?: string })?.message ?? String(err)
      console.error('[auth] verification failed:', errName, msg)
      return c.json({ error: 'Invalid or expired token', code: 401, reason: `${errName}: ${msg}` }, 401)
    }

    // IMPORTANT: next() must be OUTSIDE the try/catch above, otherwise
    // downstream route errors (e.g. Durable Object failures) get caught
    // and misreported as 401 "Invalid or expired token".
    await next()
  }
)

export function requireRole(minRole: Role) {
  return createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(async (c, next) => {
    const user = c.get('user')
    if (!user || !hasRole(user.role, minRole)) {
      return c.json({ error: 'Insufficient permissions', code: 403 }, 403)
    }
    await next()
  })
}
