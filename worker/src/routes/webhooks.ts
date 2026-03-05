import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env } from '../types'

const webhooks = new Hono<{ Bindings: Env }>()

webhooks.post('/teams', async (c) => {
  const body = await c.req.json<{
    type: string
    text?: string
    from?: { id: string; name: string }
  }>()

  if (body.type !== 'message' || !body.text) {
    return c.json({ type: 'message', text: 'OK' })
  }

  const text = body.text.trim()
  const statusMatch = text.match(/^status\s+(.+)$/i)

  if (!statusMatch) {
    return c.json({ type: 'message', text: 'Commands: "Status [Room Name]"' })
  }

  const db = getDb(c.env.DATABASE_URL)
  const roomName = statusMatch[1].trim()

  const room = await db.query.rooms.findFirst({
    where: (r, { ilike }) => ilike(r.name, `%${roomName}%`),
    with: {
      roomFlags: { with: { flag: true } },
      sprayLogs: { orderBy: [desc(schema.sprayLogs.appliedAt)], limit: 1 },
    },
  })

  if (!room) {
    return c.json({ type: 'message', text: `Room "${roomName}" not found.` })
  }

  const flagList = room.roomFlags.map((rf) => rf.flag.label).join(', ') || 'None'
  const lastSpray = room.sprayLogs[0]
  const sprayLine = lastSpray
    ? `Last spray: ${lastSpray.product} on ${new Date(lastSpray.appliedAt).toLocaleDateString('en-CA')}`
    : 'No spray logs'

  const reEntry = room.reEntryExpiresAt
    ? new Date(room.reEntryExpiresAt) > new Date()
      ? `Re-entry: ${new Date(room.reEntryExpiresAt).toLocaleString('en-CA')}`
      : 'Re-entry: CLEARED'
    : ''

  const replyText = [
    `**${room.name}**`,
    `Mode: ${room.mode.toUpperCase()}`,
    `Flags: ${flagList}`,
    sprayLine,
    reEntry,
  ].filter(Boolean).join('\n')

  return c.json({ type: 'message', text: replyText })
})

export { webhooks }
