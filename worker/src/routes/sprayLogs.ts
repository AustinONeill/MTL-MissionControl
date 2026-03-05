import { Hono } from 'hono'
import { getDb } from '../db'
import { sendTeamsAlert } from '../integrations/teams'
import type { Env, HonoVariables } from '../types'

const sprayLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

sprayLogs.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const { roomId, from, to } = c.req.query()

  const where: Record<string, unknown> = {}
  if (roomId) where.roomId = roomId
  if (from || to) {
    where.appliedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.sprayLog.findMany({
    where,
    orderBy: { appliedAt: 'desc' },
    take: 100,
  })
  return c.json(logs)
})

sprayLogs.post('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')

  const body = await c.req.json<{
    roomId: string
    product: string
    rate: string
    method?: string
    pcpRegNumber?: string
    appliedAt: string
    reEntryHours: number
    photoUrl?: string
    notes?: string
  }>()

  if (!body.roomId || !body.product || !body.rate || !body.appliedAt || !body.reEntryHours) {
    return c.json({ error: 'roomId, product, rate, appliedAt, and reEntryHours are required', code: 400 }, 400)
  }

  const room = await db.room.findUnique({ where: { id: body.roomId } })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const appliedAt = new Date(body.appliedAt)
  const reEntryExpiresAt = new Date(appliedAt.getTime() + body.reEntryHours * 3600 * 1000)

  const log = await db.sprayLog.create({
    data: {
      roomId: body.roomId,
      product: body.product,
      rate: body.rate,
      method: body.method,
      pcpRegNumber: body.pcpRegNumber,
      operatorId: user.userId,
      operatorName: user.name,
      appliedAt,
      reEntryHours: body.reEntryHours,
      reEntryExpiresAt,
      photoUrl: body.photoUrl,
      notes: body.notes,
    },
  })

  // Update room's reEntryExpiresAt
  await db.room.update({
    where: { id: body.roomId },
    data: { reEntryExpiresAt },
  })

  await db.eventLog.create({
    data: {
      roomId: body.roomId,
      operatorId: user.userId,
      operatorName: user.name,
      action: 'SPRAY_LOG',
      newValue: `${body.product} @ ${body.rate}`,
      source: 'UI',
    },
  })

  // Broadcast updated room to Durable Object
  try {
    const updatedRoom = await db.room.findUnique({
      where: { id: body.roomId },
      include: { flags: { include: { flag: true } } },
    })
    const doId = c.env.ROOM_DO.idFromName(body.roomId)
    const stub = c.env.ROOM_DO.get(doId)
    await stub.fetch('https://room-do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_UPDATED', room: updatedRoom }),
    })
  } catch { /* non-critical */ }

  // Teams alert
  try {
    await sendTeamsAlert(c.env.TEAMS_WEBHOOK_URL, {
      type: 'SPRAY_LOG',
      roomName: room.name,
      operator: user.name,
      detail: `${body.product} @ ${body.rate} — re-entry in ${body.reEntryHours}h`,
    })
  } catch { /* non-critical */ }

  return c.json(log, 201)
})

export { sprayLogs }
