import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { requireRole } from '../middleware/auth'
import type { Env, HonoVariables, RoomMode } from '../types'

const VALID_MODES: RoomMode[] = ['veg', 'flower', 'flush', 'dry', 'idle', 'maintenance']

const rooms = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

// GET /api/rooms — all rooms with their active flags
rooms.get('/', async (c) => {
  const db = getDb(c.env)
  const all = await db.query.rooms.findMany({
    with: { roomFlags: { with: { flag: true } } },
    orderBy: (r, { asc }) => [asc(r.name)],
  })
  return c.json(all)
})

// GET /api/rooms/:id — single room with flags + recent logs
rooms.get('/:id', async (c) => {
  const db = getDb(c.env)
  const id = c.req.param('id')
  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, id),
    with: {
      roomFlags:       { with: { flag: true } },
      sprayLogs:       { orderBy: (l, { desc }) => [desc(l.appliedAt)],    limit: 10 },
      calibrationLogs: { orderBy: (l, { desc }) => [desc(l.calibratedAt)], limit: 10 },
    },
  })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)
  return c.json(room)
})

// PATCH /api/rooms/:id — update mode
rooms.patch('/:id', requireRole('master_grower'), async (c) => {
  const db = getDb(c.env)
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json<{ mode?: string }>()

  if (!body.mode || !VALID_MODES.includes(body.mode as RoomMode)) {
    return c.json({ error: 'Invalid or missing mode', code: 400 }, 400)
  }

  const existing = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, id) })
  if (!existing) return c.json({ error: 'Room not found', code: 404 }, 404)

  const [updated] = await db
    .update(schema.rooms)
    .set({ mode: body.mode, updatedAt: new Date() })
    .where(eq(schema.rooms.id, id))
    .returning()

  await db.insert(schema.eventLogs).values({
    roomId:        id,
    operatorId:    user.userId,
    operatorName:  user.name,
    action:        'MODE_CHANGE',
    previousValue: existing.mode,
    newValue:      body.mode,
    source:        'UI',
  })

  await broadcastRoom(c.env, id, db)
  return c.json(updated)
})

// POST /api/rooms/:id/flags — assign flag to room
rooms.post('/:id/flags', async (c) => {
  const db = getDb(c.env)
  const user = c.get('user')
  const roomId = c.req.param('id')
  const body = await c.req.json<{ flagId: string }>()

  if (!body.flagId) return c.json({ error: 'flagId required', code: 400 }, 400)

  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const flag = await db.query.flags.findFirst({ where: eq(schema.flags.id, body.flagId) })
  if (!flag) return c.json({ error: 'Flag not found', code: 404 }, 404)

  const existing = await db.query.roomFlags.findFirst({
    where: and(eq(schema.roomFlags.roomId, roomId), eq(schema.roomFlags.flagId, body.flagId)),
  })
  if (existing) return c.json({ error: 'Flag already assigned to this room', code: 409 }, 409)

  const [roomFlag] = await db
    .insert(schema.roomFlags)
    .values({ roomId, flagId: body.flagId, assignedBy: user.userId })
    .returning()

  await db.insert(schema.eventLogs).values({
    roomId, operatorId: user.userId, operatorName: user.name,
    action: 'FLAG_ASSIGN', newValue: flag.type, source: 'UI',
  })

  await broadcastRoom(c.env, roomId, db)
  return c.json(roomFlag, 201)
})

// DELETE /api/rooms/:id/flags/:flagId — remove flag from room
rooms.delete('/:id/flags/:flagId', async (c) => {
  const db = getDb(c.env)
  const user = c.get('user')
  const roomId = c.req.param('id')
  const flagId = c.req.param('flagId')

  const roomFlag = await db.query.roomFlags.findFirst({
    where: and(eq(schema.roomFlags.roomId, roomId), eq(schema.roomFlags.flagId, flagId)),
    with: { flag: true },
  })
  if (!roomFlag) return c.json({ error: 'Flag assignment not found', code: 404 }, 404)

  await db.delete(schema.roomFlags).where(
    and(eq(schema.roomFlags.roomId, roomId), eq(schema.roomFlags.flagId, flagId))
  )

  await db.insert(schema.eventLogs).values({
    roomId, operatorId: user.userId, operatorName: user.name,
    action: 'FLAG_REMOVE', previousValue: roomFlag.flag.type, source: 'UI',
  })

  await broadcastRoom(c.env, roomId, db)
  return new Response(null, { status: 204 })
})

// ── Helper: broadcast updated room snapshot to its Durable Object ──────────
async function broadcastRoom(env: Env, roomId: string, db: ReturnType<typeof getDb>) {
  try {
    const updatedRoom = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
      with: { roomFlags: { with: { flag: true } } },
    })
    const doId = env.ROOM_DO.idFromName(roomId)
    await env.ROOM_DO.get(doId).fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updatedRoom }),
    })
  } catch { /* non-critical */ }
}

export { rooms }
