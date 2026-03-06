import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const netLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

netLogs.get('/', async (c) => {
    const db = getDb(c.env)
    const { roomId, from, to } = c.req.query()

    const conditions = []
    if (roomId) conditions.push(eq(schema.netLogs.roomId, roomId))
    if (from) conditions.push(gte(schema.netLogs.loggedAt, new Date(from)))
    if (to) conditions.push(lte(schema.netLogs.loggedAt, new Date(to)))

    const logs = await db.query.netLogs.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: (l, { desc }) => [desc(l.loggedAt)],
        limit: 100,
    })
    return c.json(logs)
})

netLogs.post('/', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const body = await c.req.json<{
        roomId: string
        netNumber: number
        action: string
        status: string
        zipTieChecks: Record<string, boolean[]>
        allZipTiesConfirmed: boolean
        photoUrl?: string
        notes?: string
    }>()

    if (!body.roomId || !body.netNumber || !body.action || !body.status) {
        return c.json({ error: 'roomId, netNumber, action, status are required', code: 400 }, 400)
    }

    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
    if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

    const [log] = await db.insert(schema.netLogs).values({
        roomId: body.roomId,
        netNumber: body.netNumber,
        action: body.action,
        status: body.status,
        zipTieChecks: body.zipTieChecks ?? {},
        allZipTiesConfirmed: body.allZipTiesConfirmed ?? false,
        operatorId: user.userId,
        operatorName: user.name,
        photoUrl: body.photoUrl,
        notes: body.notes,
    }).returning()

    await db.insert(schema.eventLogs).values({
        roomId: body.roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: 'NET_LOG',
        newValue: `Net ${body.netNumber} — ${body.action} — ${body.status}`,
        source: 'UI',
    })

    return c.json(log, 201)
})

export { netLogs }
