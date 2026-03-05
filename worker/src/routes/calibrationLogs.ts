import { Hono } from 'hono'
import { getDb } from '../db'
import type { Env, HonoVariables } from '../types'

const calibrationLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

calibrationLogs.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const { roomId, from, to } = c.req.query()

  const where: Record<string, unknown> = {}
  if (roomId) where.roomId = roomId
  if (from || to) {
    where.calibratedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.calibrationLog.findMany({
    where,
    orderBy: { calibratedAt: 'desc' },
    take: 100,
  })
  return c.json(logs)
})

calibrationLogs.post('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')

  const body = await c.req.json<{
    roomId: string
    equipmentType: string
    preReading: number
    standard: string
    postReading: number
    passFail: boolean
    calibratedAt: string
    photoUrl?: string
    notes?: string
  }>()

  const required = ['roomId', 'equipmentType', 'standard', 'calibratedAt'] as const
  for (const field of required) {
    if (!body[field]) return c.json({ error: `${field} is required`, code: 400 }, 400)
  }
  if (body.preReading === undefined || body.postReading === undefined || body.passFail === undefined) {
    return c.json({ error: 'preReading, postReading, and passFail are required', code: 400 }, 400)
  }

  const room = await db.room.findUnique({ where: { id: body.roomId } })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const log = await db.calibrationLog.create({
    data: {
      roomId: body.roomId,
      equipmentType: body.equipmentType,
      preReading: body.preReading,
      standard: body.standard,
      postReading: body.postReading,
      passFail: body.passFail,
      operatorId: user.userId,
      operatorName: user.name,
      calibratedAt: new Date(body.calibratedAt),
      photoUrl: body.photoUrl,
      notes: body.notes,
    },
  })

  await db.eventLog.create({
    data: {
      roomId: body.roomId,
      operatorId: user.userId,
      operatorName: user.name,
      action: 'CALIBRATION_LOG',
      newValue: `${body.equipmentType} — ${body.passFail ? 'PASS' : 'FAIL'}`,
      source: 'UI',
    },
  })

  return c.json(log, 201)
})

export { calibrationLogs }
