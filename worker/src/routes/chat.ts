import { Hono } from 'hono'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { getDb } from '../db'
import { conversations, messages, rooms, tasks } from '../schema'
import type { Env, HonoVariables } from '../types'

// ── REST routes (mounted under /api/chat, protected by authMiddleware) ──────
export const chat = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

const GLOBAL_CHANNELS = [
  { id: 'global:general', name: '#general',  description: 'Team-wide discussion', type: 'global' as const },
  { id: 'global:ipm',     name: '#ipm',      description: 'IPM & pest control',   type: 'global' as const },
  { id: 'global:alerts',  name: '#alerts',   description: 'System alerts',        type: 'global' as const },
]

// GET /api/chat/conversations — list all + auto-seed on first call
chat.get('/conversations', async (c) => {
  const db = getDb(c.env)

  const [existing, allRooms] = await Promise.all([
    db.select().from(conversations),
    db.select({ id: rooms.id, name: rooms.name }).from(rooms),
  ])

  const existingIds = new Set(existing.map(cv => cv.id))
  const toCreate: (typeof conversations.$inferInsert)[] = []

  for (const g of GLOBAL_CHANNELS) {
    if (!existingIds.has(g.id)) toCreate.push(g)
  }
  for (const room of allRooms) {
    const convId = `room:${room.id}`
    if (!existingIds.has(convId)) {
      toCreate.push({ id: convId, type: 'room_channel', name: `#${room.id}`, roomId: room.id })
    }
  }

  if (toCreate.length > 0) {
    await db.insert(conversations).values(toCreate).onConflictDoNothing()
  }

  const all = await db.select().from(conversations)
  const sorted = [
    ...all.filter(cv => cv.type === 'global').sort((a, b) => a.name.localeCompare(b.name)),
    ...all.filter(cv => cv.type === 'room_channel').sort((a, b) => a.name.localeCompare(b.name)),
  ]
  return c.json(sorted)
})

// GET /api/chat/conversations/:id/messages?limit=50
chat.get('/conversations/:id/messages', async (c) => {
  const db    = getDb(c.env)
  const { id }  = c.req.param()
  const limit   = Math.min(Number(c.req.query('limit') ?? 50), 100)

  const msgs = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, id), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(limit)

  return c.json(msgs.reverse())
})

// POST /api/chat/conversations/:id/messages
chat.post('/conversations/:id/messages', async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const { id }  = c.req.param()
  const body    = await c.req.json<{
    content:        string
    contentType?:   string
    actionType?:    string
    actionPayload?: Record<string, string>
    photoUrl?:      string
    replyToId?:     string
  }>()

  if (!body.content?.trim()) return c.json({ error: 'content required' }, 400)

  const [msg] = await db.insert(messages).values({
    conversationId: id,
    senderId:       user.userId,
    senderName:     user.name,
    content:        body.content,
    contentType:    body.contentType ?? 'text',
    actionType:     body.actionType,
    actionPayload:  body.actionPayload,
    photoUrl:       body.photoUrl,
    replyToId:      body.replyToId,
  }).returning()

  // Auto-create whiteboard task and include it in the response + broadcast
  let createdTask = null
  if (body.actionType === 'create_task' && body.actionPayload) {
    const p = body.actionPayload
    const title = [p.taskLabel, p.subtask].filter(Boolean).join(' — ');
    [createdTask] = await db.insert(tasks).values({
      title,
      description:   body.content,
      roomId:        p.roomId || undefined,
      priority:      'normal',
      status:        'todo',
      createdBy:     user.userId,
      createdByName: user.name,
    }).returning()
  }

  // Broadcast to all WS clients — include createdTask so every client updates instantly
  try {
    const doId = c.env.CONVERSATION_DO.idFromName(id)
    const stub = c.env.CONVERSATION_DO.get(doId)
    await stub.fetch(new Request('http://do-internal/broadcast', {
      method: 'POST',
      body:   JSON.stringify({ type: 'message', data: { ...msg, createdTask } }),
    }))
  } catch (e) {
    console.warn('[chat] DO broadcast failed:', e)
  }

  return c.json({ ...msg, createdTask }, 201)
})

// ── WebSocket upgrade route (mounted under /ws/chat, no authMiddleware) ─────
export const chatWs = new Hono<{ Bindings: Env }>()

chatWs.get('/:id', async (c) => {
  const { id } = c.req.param()
  const token  = c.req.query('token')

  if (!token) return c.json({ error: 'Missing token' }, 401)
  try {
    const jwksRes = await fetch(c.env.STACK_AUTH_JWKS_URL)
    const JWKS = createLocalJWKSet(await jwksRes.json() as { keys: object[] })
    await jwtVerify(token, JWKS, { audience: c.env.STACK_AUTH_PROJECT_ID })
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const doId = c.env.CONVERSATION_DO.idFromName(id)
  const stub = c.env.CONVERSATION_DO.get(doId)
  return stub.fetch(c.req.raw)
})
