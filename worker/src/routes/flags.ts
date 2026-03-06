import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'

// Flags replaced by the overlays system.
// These stubs keep the /api/flags route mounted (backwards compat)
// and direct consumers to the new API.
const flags = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

flags.all('*', (c) =>
  c.json({ error: 'Flags have been replaced by the overlays API. Use /api/rooms/:id/overlays.', code: 410 }, 410)
)

export { flags }
