import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { sendTeamsAlert } from '../integrations/teams'
import type { Env, HonoVariables } from '../types'

const potCheckLogs = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

potCheckLogs.get('/', async (c) => {
    const db = getDb(c.env)
    const { roomId, from, to } = c.req.query()

    const conditions = []
    if (roomId) conditions.push(eq(schema.potCheckLogs.roomId, roomId))
    if (from) conditions.push(gte(schema.potCheckLogs.checkedAt, new Date(from)))
    if (to) conditions.push(lte(schema.potCheckLogs.checkedAt, new Date(to)))

    const logs = await db.query.potCheckLogs.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: (l, { desc }) => [desc(l.checkedAt)],
        limit: 100,
    })
    return c.json(logs)
})

potCheckLogs.post('/', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const body = await c.req.json<{
        roomId: string
        standingWaterFound: boolean
        waterRemoved?: boolean
        rootHealth: string
        photoUrl?: string
        notes?: string
    }>()

    if (!body.roomId || body.standingWaterFound === undefined || !body.rootHealth) {
        return c.json({ error: 'roomId, standingWaterFound, rootHealth are required', code: 400 }, 400)
    }

    // Photo required if rootHealth is critical
    if (body.rootHealth === 'critical' && !body.photoUrl) {
        return c.json({ error: 'Photo is required when root health is critical', code: 400 }, 400)
    }

    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId) })
    if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

    const [log] = await db.insert(schema.potCheckLogs).values({
        roomId: body.roomId,
        standingWaterFound: body.standingWaterFound,
        waterRemoved: body.waterRemoved,
        rootHealth: body.rootHealth,
        operatorId: user.userId,
        operatorName: user.name,
        photoUrl: body.photoUrl,
        notes: body.notes,
    }).returning()

    await db.insert(schema.eventLogs).values({
        roomId: body.roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: 'POT_CHECK',
        newValue: `rootHealth: ${body.rootHealth}`,
        source: 'UI',
    })

    // Alert if root health is concern or critical
    if (body.rootHealth !== 'healthy') {
        try {
            await sendTeamsAlert(c.env.TEAMS_WEBHOOK_URL, {
                type: 'POT_CHECK',
                roomName: room.name,
                operator: user.name,
                detail: `Root health: ${body.rootHealth.toUpperCase()}`,
            })
        } catch { /* non-critical */ }
    }

    return c.json(log, 201)
})

export { potCheckLogs }
