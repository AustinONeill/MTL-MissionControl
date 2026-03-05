import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const events = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

events.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const { roomId, from, to } = c.req.query()

  const conditions = []
  if (roomId) conditions.push(eq(schema.eventLogs.roomId, roomId))
  if (from)   conditions.push(gte(schema.eventLogs.createdAt, new Date(from)))
  if (to)     conditions.push(lte(schema.eventLogs.createdAt, new Date(to)))

  const logs = await db.query.eventLogs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    limit: 200,
  })
  return c.json(logs)
})

export { events }
