import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const ppeLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

ppeLogs.get('/', async (c) => {
  const db = getDb(c.env)
  const { roomId, limit } = c.req.query()

  const conditions = []
  if (roomId) conditions.push(eq(schema.ppeLogs.roomId, roomId))

  const logs = await db.query.ppeLogs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (l, { desc }) => [desc(l.loggedAt)],
    limit: limit ? parseInt(limit) : 50,
  })
  return c.json(logs)
})

ppeLogs.post('/', async (c) => {
  const db = getDb(c.env)
  const user = c.get('user')
  const body = await c.req.json<{
    roomId: string
    itemsWorn: string[]
    context?: string
    notes?: string
  }>()

  if (!body.roomId || !Array.isArray(body.itemsWorn) || body.itemsWorn.length === 0) {
    return c.json({ error: 'roomId and itemsWorn[] are required', code: 400 }, 400)
  }

  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const [log] = await db.insert(schema.ppeLogs).values({
    roomId:       body.roomId,
    itemsWorn:    body.itemsWorn,
    context:      body.context ?? 'standard',
    operatorId:   user.userId,
    operatorName: user.name,
    notes:        body.notes,
  }).returning()

  await db.insert(schema.eventLogs).values({
    roomId:       body.roomId,
    operatorId:   user.userId,
    operatorName: user.name,
    action:       'PPE_CONFIRMED',
    newValue:     `context: ${body.context ?? 'standard'}, items: ${body.itemsWorn.join(', ')}`,
    source:       'UI',
  })

  return c.json(log, 201)
})

export { ppeLogs }
