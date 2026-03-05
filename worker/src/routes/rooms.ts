import { Hono } from 'hono'
import { getDb } from '../db'
import { requireRole } from '../middleware/auth'
import type { Env, HonoVariables, RoomMode } from '../types'

const VALID_MODES: RoomMode[] = ['veg', 'flower', 'flush', 'dry', 'idle', 'maintenance']

const rooms = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

rooms.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const allRooms = await db.room.findMany({
    include: {
      flags: {
        include: { flag: true },
        orderBy: { assignedAt: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })
  return c.json(allRooms)
})

rooms.get('/:id', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const room = await db.room.findUnique({
    where: { id: c.req.param('id') },
    include: {
      flags: { include: { flag: true } },
      sprayLogs: { orderBy: { appliedAt: 'desc' }, take: 10 },
      calibrationLogs: { orderBy: { calibratedAt: 'desc' }, take: 10 },
    },
  })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)
  return c.json(room)
})

rooms.patch('/:id', requireRole('master_grower'), async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json<{ mode?: string }>()

  if (!body.mode || !VALID_MODES.includes(body.mode as RoomMode)) {
    return c.json({ error: 'Invalid or missing mode', code: 400 }, 400)
  }

  const existing = await db.room.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Room not found', code: 404 }, 404)

  const updated = await db.room.update({
    where: { id },
    data: { mode: body.mode },
    include: { flags: { include: { flag: true } } },
  })

  await db.eventLog.create({
    data: {
      roomId: id,
      operatorId: user.userId,
      operatorName: user.name,
      action: 'MODE_CHANGE',
      previousValue: existing.mode,
      newValue: body.mode,
      source: 'UI',
    },
  })

  // Broadcast to Durable Object
  try {
    const doId = c.env.ROOM_DO.idFromName(id)
    const stub = c.env.ROOM_DO.get(doId)
    await stub.fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updated }),
    })
  } catch { /* non-critical */ }

  return c.json(updated)
})

// Assign flag to room
rooms.post('/:id/flags', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')
  const roomId = c.req.param('id')
  const body = await c.req.json<{ flagId: string }>()

  if (!body.flagId) return c.json({ error: 'flagId required', code: 400 }, 400)

  const room = await db.room.findUnique({ where: { id: roomId } })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const flag = await db.flag.findUnique({ where: { id: body.flagId } })
  if (!flag) return c.json({ error: 'Flag not found', code: 404 }, 404)

  // Check for duplicate
  const existing = await db.roomFlag.findUnique({
    where: { roomId_flagId: { roomId, flagId: body.flagId } },
  })
  if (existing) return c.json({ error: 'Flag already assigned to this room', code: 409 }, 409)

  const roomFlag = await db.roomFlag.create({
    data: {
      roomId,
      flagId: body.flagId,
      assignedBy: user.userId,
    },
    include: { flag: true },
  })

  await db.eventLog.create({
    data: {
      roomId,
      operatorId: user.userId,
      operatorName: user.name,
      action: 'FLAG_ASSIGN',
      newValue: flag.type,
      source: 'UI',
    },
  })

  // Broadcast
  try {
    const updatedRoom = await db.room.findUnique({
      where: { id: roomId },
      include: { flags: { include: { flag: true } } },
    })
    const doId = c.env.ROOM_DO.idFromName(roomId)
    const stub = c.env.ROOM_DO.get(doId)
    await stub.fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updatedRoom }),
    })
  } catch { /* non-critical */ }

  return c.json(roomFlag, 201)
})

// Remove flag from room
rooms.delete('/:id/flags/:flagId', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')
  const roomId = c.req.param('id')
  const flagId = c.req.param('flagId')

  const roomFlag = await db.roomFlag.findUnique({
    where: { roomId_flagId: { roomId, flagId } },
    include: { flag: true },
  })
  if (!roomFlag) return c.json({ error: 'Flag assignment not found', code: 404 }, 404)

  await db.roomFlag.delete({ where: { roomId_flagId: { roomId, flagId } } })

  await db.eventLog.create({
    data: {
      roomId,
      operatorId: user.userId,
      operatorName: user.name,
      action: 'FLAG_REMOVE',
      previousValue: roomFlag.flag.type,
      source: 'UI',
    },
  })

  // Broadcast
  try {
    const updatedRoom = await db.room.findUnique({
      where: { id: roomId },
      include: { flags: { include: { flag: true } } },
    })
    const doId = c.env.ROOM_DO.idFromName(roomId)
    const stub = c.env.ROOM_DO.get(doId)
    await stub.fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updatedRoom }),
    })
  } catch { /* non-critical */ }

  return new Response(null, { status: 204 })
})

export { rooms }
