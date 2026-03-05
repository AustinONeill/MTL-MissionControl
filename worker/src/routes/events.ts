import { Hono } from 'hono'
import { getDb } from '../db'
import type { Env, HonoVariables } from '../types'

const events = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

events.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const { roomId, from, to } = c.req.query()

  const where: Record<string, unknown> = {}
  if (roomId) where.roomId = roomId
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.eventLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json(logs)
})

export { events }
