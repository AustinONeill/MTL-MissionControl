import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../schema'
import type { Env, HonoVariables } from '../types'

const tasks = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

tasks.get('/', async (c) => {
  const db = getDb(c.env)
  const { status, roomId } = c.req.query()
  const conditions = []
  if (status) conditions.push(eq(schema.tasks.status, status))
  if (roomId) conditions.push(eq(schema.tasks.roomId, roomId))
  const rows = await db.query.tasks.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })
  return c.json(rows)
})

tasks.post('/', async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const body = await c.req.json<{
    title: string
    description?: string
    roomId?: string
    assignedTo?: string
    priority?: string
  }>()

  if (!body.title?.trim()) return c.json({ error: 'title is required', code: 400 }, 400)

  const [task] = await db.insert(schema.tasks).values({
    title:         body.title.trim(),
    description:   body.description?.trim() || null,
    roomId:        body.roomId || null,
    assignedTo:    body.assignedTo?.trim() || null,
    priority:      body.priority ?? 'normal',
    status:        'todo',
    createdBy:     user.userId,
    createdByName: user.name,
  }).returning()

  return c.json(task, 201)
})

tasks.patch('/:id', async (c) => {
  const db   = getDb(c.env)
  const body = await c.req.json<{
    status?: string
    title?: string
    description?: string
    assignedTo?: string
    priority?: string
    roomId?: string
  }>()

  const [task] = await db
    .update(schema.tasks)
    .set({
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.assignedTo  !== undefined && { assignedTo: body.assignedTo }),
      ...(body.priority    !== undefined && { priority: body.priority }),
      ...(body.roomId      !== undefined && { roomId: body.roomId }),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, c.req.param('id')))
    .returning()

  if (!task) return c.json({ error: 'Task not found', code: 404 }, 404)
  return c.json(task)
})

tasks.delete('/:id', async (c) => {
  await getDb(c.env).delete(schema.tasks).where(eq(schema.tasks.id, c.req.param('id')))
  return c.json({ ok: true })
})

export { tasks }
