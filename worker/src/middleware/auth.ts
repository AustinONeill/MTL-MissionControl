import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
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

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(
  async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header', code: 401 }, 401)
    }

    const token = authorization.slice(7)

    try {
      const jwksUrl = new URL(c.env.STACK_AUTH_JWKS_URL)
      const JWKS = createRemoteJWKSet(jwksUrl)

      const { payload } = await jwtVerify(token, JWKS, {
        audience: c.env.STACK_AUTH_PROJECT_ID,
      })

      const role = (payload['role'] as Role) ?? 'gardener'
      const userId = payload.sub ?? ''
      const email = (payload['email'] as string) ?? ''
      const name = (payload['name'] as string) ?? email

      c.set('user', { userId, role, email, name })
      await next()
    } catch {
      return c.json({ error: 'Invalid or expired token', code: 401 }, 401)
    }
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
