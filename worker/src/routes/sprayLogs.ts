import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { sendTeamsAlert } from '../integrations/teams'
import type { Env, HonoVariables } from '../types'

const sprayLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

sprayLogs.get('/', async (c) => {
  const db = getDb(c.env)
  const { roomId, from, to } = c.req.query()

  const conditions = []
  if (roomId) conditions.push(eq(schema.sprayLogs.roomId, roomId))
  if (from) conditions.push(gte(schema.sprayLogs.appliedAt, new Date(from)))
  if (to) conditions.push(lte(schema.sprayLogs.appliedAt, new Date(to)))

  const logs = await db.query.sprayLogs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (l, { desc }) => [desc(l.appliedAt)],
    limit: 100,
  })
  return c.json(logs)
})

sprayLogs.post('/', async (c) => {
  const db = getDb(c.env)
  const user = c.get('user')
  const body = await c.req.json<{
    roomId: string
    batchIds: string
    pesticide: string
    appliedAt: string
    startTime: string
    endTime: string
    reasonPreventative: boolean
    reasonTreatment: boolean
    methodFoliarSpray: boolean
    methodDip: boolean
    equipmentNumber: string
    equipmentName: string
    ratio: string
    quantity: string
    supervisorName?: string
    reEntryHours?: number
    photoUrl?: string
    notes?: string
  }>()

  // Validate required F-005 fields
  const required = ['roomId', 'batchIds', 'pesticide', 'appliedAt', 'startTime', 'endTime',
    'equipmentNumber', 'equipmentName', 'ratio', 'quantity']
  const missing = required.filter(k => !body[k as keyof typeof body])
  if (missing.length) {
    return c.json({ error: `Missing required fields: ${missing.join(', ')}`, code: 400 }, 400)
  }

  // Supervisor role gate — only master_grower / director can set supervisorName
  const supervisorRoles = ['master_grower', 'director']
  const isSupervisor = supervisorRoles.includes(user.role ?? '')
  if (body.supervisorName && !isSupervisor) {
    return c.json({ error: 'Only master_grower or director can sign off as supervisor', code: 403 }, 403)
  }

  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const appliedAt = new Date(body.appliedAt)
  const reEntryHours = body.reEntryHours ?? 0
  const reEntryExpiresAt = reEntryHours > 0
    ? new Date(appliedAt.getTime() + reEntryHours * 3600 * 1000)
    : null

  const [log] = await db.insert(schema.sprayLogs).values({
    roomId: body.roomId,
    batchIds: body.batchIds,
    pesticide: body.pesticide,
    appliedAt,
    startTime: body.startTime,
    endTime: body.endTime,
    reasonPreventative: body.reasonPreventative ?? false,
    reasonTreatment: body.reasonTreatment ?? false,
    methodFoliarSpray: body.methodFoliarSpray ?? false,
    methodDip: body.methodDip ?? false,
    equipmentNumber: body.equipmentNumber,
    equipmentName: body.equipmentName,
    ratio: body.ratio,
    quantity: body.quantity,
    operatorId: user.userId,
    operatorName: user.name,
    supervisorName: body.supervisorName ?? '',
    reEntryHours,
    reEntryExpiresAt,
    photoUrl: body.photoUrl,
    notes: body.notes,
  }).returning()

  // Update room's reEntryExpiresAt if applicable
  if (reEntryExpiresAt) {
    await db.update(schema.rooms)
      .set({ reEntryExpiresAt, updatedAt: new Date() })
      .where(eq(schema.rooms.id, body.roomId))
  }

  await db.insert(schema.eventLogs).values({
    roomId: body.roomId,
    operatorId: user.userId,
    operatorName: user.name,
    action: 'SPRAY_LOG',
    newValue: `${body.pesticide} — ${body.quantity}`,
    source: 'UI',
  })

  // Broadcast to Durable Object
  try {
    const updatedRoom = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, body.roomId),
      with: { overlays: true },
    })
    const doId = c.env.ROOM_DO.idFromName(body.roomId)
    await c.env.ROOM_DO.get(doId).fetch('https://room-do/broadcast', {
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
      detail: `${body.pesticide} — ${body.quantity} | re-entry: ${reEntryHours}h`,
    })
  } catch { /* non-critical */ }

  return c.json(log, 201)
})

export { sprayLogs }
