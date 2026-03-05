import { Hono } from 'hono'
import { getDb } from '../db'
import type { Env } from '../types'

const webhooks = new Hono<{ Bindings: Env }>()

// Microsoft Teams Bot Framework webhook
webhooks.post('/teams', async (c) => {
  const body = await c.req.json<{
    type: string
    text?: string
    from?: { id: string; name: string }
    conversation?: { id: string }
    serviceUrl?: string
    id?: string
  }>()

  if (body.type !== 'message' || !body.text) {
    return c.json({ type: 'message', text: 'OK' })
  }

  const text = body.text.trim()
  const statusMatch = text.match(/^status\s+(.+)$/i)

  if (!statusMatch) {
    return c.json({
      type: 'message',
      text: 'Commands: "Status [Room Name]"',
    })
  }

  const db = getDb(c.env.DATABASE_URL)
  const roomName = statusMatch[1].trim()

  const room = await db.room.findFirst({
    where: { name: { contains: roomName, mode: 'insensitive' } },
    include: {
      flags: { include: { flag: true } },
      sprayLogs: { orderBy: { appliedAt: 'desc' }, take: 1 },
    },
  })

  if (!room) {
    return c.json({ type: 'message', text: `Room "${roomName}" not found.` })
  }

  const flagList = room.flags.map((rf) => rf.flag.label).join(', ') || 'None'
  const lastSpray = room.sprayLogs[0]
  const sprayLine = lastSpray
    ? `Last spray: ${lastSpray.product} on ${new Date(lastSpray.appliedAt).toLocaleDateString()}`
    : 'No spray logs'

  const reEntry = room.reEntryExpiresAt
    ? new Date(room.reEntryExpiresAt) > new Date()
      ? `Re-entry: ${new Date(room.reEntryExpiresAt).toLocaleString()}`
      : 'Re-entry: CLEARED'
    : ''

  const replyText = [
    `**${room.name}**`,
    `Mode: ${room.mode.toUpperCase()}`,
    `Flags: ${flagList}`,
    sprayLine,
    reEntry,
  ]
    .filter(Boolean)
    .join('\n')

  return c.json({ type: 'message', text: replyText })
})

export { webhooks }
