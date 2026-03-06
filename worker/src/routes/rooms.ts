import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { requireRole } from '../middleware/auth'
import { overlayRoutes } from './overlays'
import type { Env, HonoVariables, RoomMode } from '../types'

const VALID_MODES: RoomMode[] = ['off', 'auto', 'crop', 'fill']

const rooms = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

// GET /api/rooms — all rooms with their active overlays
rooms.get('/', async (c) => {
  const db = getDb(c.env)
  const all = await db.query.rooms.findMany({
    with: { overlays: true },
    orderBy: (r, { asc }) => [asc(r.name)],
  })
  return c.json(all)
})

// GET /api/rooms/:id — single room with overlays + recent logs
rooms.get('/:id', async (c) => {
  const db = getDb(c.env)
  const id = c.req.param('id')
  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, id),
    with: {
      overlays: true,
      sprayLogs: { orderBy: (l, { desc }) => [desc(l.appliedAt)], limit: 10 },
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
    roomId: id,
    operatorId: user.userId,
    operatorName: user.name,
    action: 'MODE_CHANGE',
    previousValue: existing.mode,
    newValue: body.mode,
    source: 'UI',
  })

  await broadcastRoom(c.env, id, db)
  return c.json(updated)
})


// ── Note: flag assignment endpoints removed ───────────────────────────────
// Overlays replaced the old flags system. Use POST /api/rooms/:id/overlays
// (mounted via overlayRoutes sub-router below).


// ── Helper: broadcast updated room snapshot to its Durable Object ──────────
async function broadcastRoom(env: Env, roomId: string, db: ReturnType<typeof getDb>) {
  try {
    const updatedRoom = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
      with: { overlays: true },
    })
    const doId = env.ROOM_DO.idFromName(roomId)
    await env.ROOM_DO.get(doId).fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updatedRoom }),
    })
  } catch { /* non-critical */ }
}

// ── Overlay sub-router under /:id/overlays ───────────────────────────────
rooms.route('/:id/overlays', overlayRoutes)

export { rooms }
