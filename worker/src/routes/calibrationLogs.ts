import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const calibrationLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

calibrationLogs.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const { roomId, from, to } = c.req.query()

  const conditions = []
  if (roomId) conditions.push(eq(schema.calibrationLogs.roomId, roomId))
  if (from)   conditions.push(gte(schema.calibrationLogs.calibratedAt, new Date(from)))
  if (to)     conditions.push(lte(schema.calibrationLogs.calibratedAt, new Date(to)))

  const logs = await db.query.calibrationLogs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (l, { desc }) => [desc(l.calibratedAt)],
    limit: 100,
  })
  return c.json(logs)
})

calibrationLogs.post('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL)
  const user = c.get('user')
  const body = await c.req.json<{
    roomId:        string
    equipmentType: string
    preReading:    number
    standard:      string
    postReading:   number
    passFail:      boolean
    calibratedAt:  string
    photoUrl?:     string
    notes?:        string
  }>()

  if (!body.roomId || !body.equipmentType || !body.standard || !body.calibratedAt) {
    return c.json({ error: 'roomId, equipmentType, standard, calibratedAt are required', code: 400 }, 400)
  }
  if (body.preReading === undefined || body.postReading === undefined || body.passFail === undefined) {
    return c.json({ error: 'preReading, postReading, passFail are required', code: 400 }, 400)
  }

  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
  if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

  const [log] = await db.insert(schema.calibrationLogs).values({
    roomId:        body.roomId,
    equipmentType: body.equipmentType,
    preReading:    body.preReading,
    standard:      body.standard,
    postReading:   body.postReading,
    passFail:      body.passFail,
    operatorId:    user.userId,
    operatorName:  user.name,
    calibratedAt:  new Date(body.calibratedAt),
    photoUrl:      body.photoUrl,
    notes:         body.notes,
  }).returning()

  await db.insert(schema.eventLogs).values({
    roomId:       body.roomId,
    operatorId:   user.userId,
    operatorName: user.name,
    action:       'CALIBRATION_LOG',
    newValue:     `${body.equipmentType} — ${body.passFail ? 'PASS' : 'FAIL'}`,
    source:       'UI',
  })

  return c.json(log, 201)
})

export { calibrationLogs }
