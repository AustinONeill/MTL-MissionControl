import { Hono } from 'hono'
import { getDb } from '../db'
import { requireRole } from '../middleware/auth'
import type { Env, HonoVariables } from '../types'

const flags = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

flags.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const all = await db.flag.findMany({ orderBy: { label: 'asc' } })
  return c.json(all)
})

flags.post('/', requireRole('director'), async (c) => {
  const db = getDb(c.env.DATABASE_URL)
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

  const flag = await db.flag.create({ data: body })
  return c.json(flag, 201)
})

flags.put('/:id', requireRole('director'), async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const body = await c.req.json()
  const flag = await db.flag.update({ where: { id: c.req.param('id') }, data: body })
  return c.json(flag)
})

flags.delete('/:id', requireRole('director'), async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  await db.flag.delete({ where: { id: c.req.param('id') } })
  return new Response(null, { status: 204 })
})

export { flags }
