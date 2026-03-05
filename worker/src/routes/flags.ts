import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { requireRole } from '../middleware/auth'
import type { Env, HonoVariables } from '../types'

const flags = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

flags.get('/', async (c) => {
  const db = getDb(c.env)
  const all = await db.query.flags.findMany({
    orderBy: (f, { asc }) => [asc(f.label)],
  })
  return c.json(all)
})

flags.post('/', requireRole('director'), async (c) => {
  const db = getDb(c.env)
  const body = await c.req.json<{
    type: string
    label: string
    iconUrl: string
    color: string
    notificationEnabled?: boolean
    calendarEnabled?: boolean
  }>()

  if (!body.type || !body.label || !body.iconUrl || !body.color) {
    return c.json({ error: 'type, label, iconUrl, and color are required', code: 400 }, 400)
  }

  const [flag] = await db.insert(schema.flags).values(body).returning()
  return c.json(flag, 201)
})

flags.put('/:id', requireRole('director'), async (c) => {
  const db = getDb(c.env)
  const body = await c.req.json()
  const [flag] = await db
    .update(schema.flags)
    .set(body)
    .where(eq(schema.flags.id, c.req.param('id')))
    .returning()
  return c.json(flag)
})

flags.delete('/:id', requireRole('director'), async (c) => {
  const db = getDb(c.env)
  await db.delete(schema.flags).where(eq(schema.flags.id, c.req.param('id')))
  return new Response(null, { status: 204 })
})

export { flags }
