import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const filterChangeLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

filterChangeLogs.get('/', async (c) => {
    const db = getDb(c.env)
    const { roomId, from, to } = c.req.query()

    const conditions = []
    if (roomId) conditions.push(eq(schema.filterChangeLogs.roomId, roomId))
    if (from) conditions.push(gte(schema.filterChangeLogs.changedAt, new Date(from)))
    if (to) conditions.push(lte(schema.filterChangeLogs.changedAt, new Date(to)))

    const logs = await db.query.filterChangeLogs.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: (l, { desc }) => [desc(l.changedAt)],
        limit: 100,
    })
    return c.json(logs)
})

filterChangeLogs.post('/', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const body = await c.req.json<{
        roomId: string
        filterType: string
        filterSize?: string
        oldCondition: string
        newInstalled: boolean
        equipmentNumber?: string
        photoUrl?: string
        notes?: string
    }>()

    if (!body.roomId || !body.filterType || !body.oldCondition || body.newInstalled === undefined) {
        return c.json({ error: 'roomId, filterType, oldCondition, newInstalled are required', code: 400 }, 400)
    }

    if (!body.newInstalled) {
        return c.json({ error: '"New Filter Installed" must be checked to save', code: 400 }, 400)
    }

    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
    if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

    const [log] = await db.insert(schema.filterChangeLogs).values({
        roomId: body.roomId,
        filterType: body.filterType,
        filterSize: body.filterSize,
        oldCondition: body.oldCondition,
        newInstalled: body.newInstalled,
        equipmentNumber: body.equipmentNumber,
        operatorId: user.userId,
        operatorName: user.name,
        photoUrl: body.photoUrl,
        notes: body.notes,
    }).returning()

    await db.insert(schema.eventLogs).values({
        roomId: body.roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: 'FILTER_CHANGE',
        newValue: `${body.filterType} — ${body.oldCondition} → new`,
        source: 'UI',
    })

    return c.json(log, 201)
})

export { filterChangeLogs }
