import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import { sendTeamsAlert } from '../integrations/teams'
import type { Env, HonoVariables } from '../types'

const overlayRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

// ── GET overlays for a room ───────────────────────────────────────────────
// GET /api/rooms/:id/overlays
overlayRoutes.get('/', async (c) => {
    const db = getDb(c.env)
    const roomId = c.req.param('id') ?? ''
    const rows = await db.query.overlays.findMany({
        where: eq(schema.overlays.roomId, roomId),
        orderBy: (o, { desc }) => [desc(o.placedAt)],
    })
    return c.json(rows)
})

// ── POST /api/rooms/:id/overlays ──────────────────────────────────────────
overlayRoutes.post('/', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const roomId = c.req.param('id') ?? ''

    const body = await c.req.json<{
        overlayType: string
        options?: Record<string, unknown>
        status?: string
    }>()

    if (!body.overlayType) {
        return c.json({ error: 'overlayType is required', code: 400 }, 400)
    }

    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) })
    if (!room) return c.json({ error: 'Room not found', code: 404 }, 404)

    const [overlay] = await db.insert(schema.overlays).values({
        roomId,
        overlayType: body.overlayType,
        options: body.options ?? {},
        status: body.status ?? 'active',
        placedBy: user.userId,
    }).returning()

    await db.insert(schema.eventLogs).values({
        roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: 'OVERLAY_PLACED',
        newValue: body.overlayType,
        source: 'UI',
    })

    await broadcastRoom(c.env, roomId, db)

    if (body.overlayType === 'ipm') {
        try {
            await sendTeamsAlert(c.env.TEAMS_WEBHOOK_URL, {
                type: 'OVERLAY_PLACED',
                roomName: room.name,
                operator: user.name,
                detail: 'IPM overlay placed — spray log required',
            })
        } catch { /* non-critical */ }
    }

    return c.json(overlay, 201)
})

// ── PATCH /api/rooms/:id/overlays/:overlayId ─────────────────────────────
overlayRoutes.patch('/:overlayId', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const roomId = c.req.param('id') ?? ''
    const overlayId = c.req.param('overlayId')

    const body = await c.req.json<{
        options?: Record<string, unknown>
        status?: string
    }>()

    const existing = await db.query.overlays.findFirst({
        where: eq(schema.overlays.id, overlayId),
    })
    if (!existing || existing.roomId !== roomId) {
        return c.json({ error: 'Overlay not found', code: 404 }, 404)
    }

    const [updated] = await db.update(schema.overlays)
        .set({
            options: body.options ?? (existing.options as Record<string, unknown>),
            status: body.status ?? existing.status,
            updatedBy: user.userId,
            updatedAt: new Date(),
        })
        .where(eq(schema.overlays.id, overlayId))
        .returning()

    await db.insert(schema.eventLogs).values({
        roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: body.status === 'completed' ? 'OVERLAY_COMPLETED' : 'OVERLAY_EDITED',
        previousValue: existing.status,
        newValue: updated.status,
        source: 'UI',
    })

    await broadcastRoom(c.env, roomId, db)
    return c.json(updated)
})

// ── DELETE /api/rooms/:id/overlays/:overlayId ─────────────────────────────
overlayRoutes.delete('/:overlayId', async (c) => {
    const db = getDb(c.env)
    const user = c.get('user')
    const roomId = c.req.param('id') ?? ''
    const overlayId = c.req.param('overlayId')

    const existing = await db.query.overlays.findFirst({
        where: eq(schema.overlays.id, overlayId),
    })
    if (!existing || existing.roomId !== roomId) {
        return c.json({ error: 'Overlay not found', code: 404 }, 404)
    }

    await db.delete(schema.overlays).where(eq(schema.overlays.id, overlayId))

    await db.insert(schema.eventLogs).values({
        roomId,
        operatorId: user.userId,
        operatorName: user.name,
        action: 'OVERLAY_REMOVED',
        previousValue: existing.overlayType,
        source: 'UI',
    })

    await broadcastRoom(c.env, roomId, db)
    return new Response(null, { status: 204 })
})

// ── helper ────────────────────────────────────────────────────────────────
async function broadcastRoom(env: Env, roomId: string, db: ReturnType<typeof getDb>) {
    try {
        const room = await db.query.rooms.findFirst({
            where: eq(schema.rooms.id, roomId),
            with: { overlays: true },
        })
        const doId = env.ROOM_DO.idFromName(roomId)
        await env.ROOM_DO.get(doId).fetch('https://room-do/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ROOM_UPDATED', room }),
        })
    } catch { /* non-critical */ }
}

export { overlayRoutes }
